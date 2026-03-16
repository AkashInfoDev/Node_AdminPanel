const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const archiver = require('archiver');
const sql = require('mssql'); // Assuming SQL Server as the database
const { google } = require('googleapis');
const { validateToken } = require('../Services/tokenServices');
const db = require("../Config/config");
const AdmZip = require('adm-zip');
const unzipper = require('unzipper');
const definePLSYS14 = require('../Models/IDB/PLSYS14');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI');
const sequelizeMASTER = db.getConnection("MASTER");
const sequelizeIDB = db.getConnection('IDBAPI');
const sequelizeRDB = db.getConnection('RDB');
const PLSYS14 = definePLSYS14(sequelizeIDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const Encryptor = require("../Services/encryptor");
const { Op, QueryTypes } = require('sequelize');
const { sendEmailWithAttachment } = require('../Services/mailServices');
const { generateDatabaseName } = require('../Services/queryService');
const encryptor = new Encryptor();

/* ================= GOOGLE OAUTH ================= */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const drive = google.drive({ version: "v3", auth: oauth2Client });

/* ================= DRIVE FOLDER ================= */
async function getOrCreateFolder(name, parentId = null) {
    const q = [
        `name='${name}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        parentId ? `'${parentId}' in parents` : null,
        "trashed=false"
    ].filter(Boolean).join(" and ");

    const res = await drive.files.list({ q, fields: "files(id,name)" });
    if (res.data.files.length) return res.data.files[0].id;

    const folder = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : []
        },
        fields: "id"
    });

    return folder.data.id;
}

/* ================= MAIN API ================= */
const getCorporateEmails = async (corporateID) => {

    // find corporate row
    const corpRow = await PLRDBA01.findOne({
        where: { A01F03: corporateID }
    });

    if (!corpRow) {
        throw new Error("Corporate not found");
    }

    const corpUnq = corpRow.A01F01;

    // build SDB database name
    const sdbSeq = corporateID.split('-');

    let sdbdbname =
        sdbSeq.length === 3
            ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB'
            : sdbSeq[0] + sdbSeq[1] + 'SDB';
    if (sdbdbname === 'PLP00001SDB') {
        sdbdbname = 'A00001SDB';
    }

    // connect SDB
    const sequelizeSDB = db.getConnection(sdbdbname);

    const PLSDBADMI = definePLSDBADMI(sequelizeSDB);

    // find admin users
    const admins = await PLSDBADMI.findAll({
        where: {
            ADMICORP: corpUnq,
            ADMIF06: { [Op.in]: [1, 2] }
        }
    });

    // extract emails
    const emails = admins
        .map(a => a.ADMIF07)
        .filter(e => e);

    return emails;
};

const backupZipToDrive = async (req, res) => {
    let response = { data: null, message: '', status: 'Success' };
    let encryptedResponse;
    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;

    try {

        /* ===============================
           1️⃣ PAYLOAD VALIDATION
        =============================== */

        if (!req.body.pa) {
            response.status = "FAIL";
            response.message = "Missing payload";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }

        const parameterString = encryptor.decrypt(req.body.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const p1 = JSON.parse(decodedParam);

        const { companyID, yearNo, refresh_token, action } = p1;

        if (!companyID || !yearNo) {
            response.status = "FAIL";
            response.message = "companyID and yearNo required";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }

        // refresh_token required only for Google Drive upload
        if (action === "G" && !refresh_token) {
            response.status = "FAIL";
            response.message = "refresh_token required for Google Drive upload";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }

        /* ===============================
           2️⃣ TOKEN VALIDATION
        =============================== */

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            response.status = "FAIL";
            response.message = "Authorization token missing";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }

        const decoded = await validateToken(token);

        if (!decoded || !decoded.corpId) {
            response.status = "FAIL";
            response.message = "Invalid token or corporateID missing";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }
        const corporateID = decoded.corpId;

        /* ===============================
           3️⃣ GENERATE DATABASE NAME
        =============================== */

        const corporateLastFive = corporateID.slice(-5);
        const formattedCompanyID = companyID.toString().padStart(4, "0");

        const sourceDatabase = `A${corporateLastFive}CMP${formattedCompanyID}`;
        const newDatabaseName = `CMP${formattedCompanyID}_${yearNo}`;

        console.log("Source DB:", sourceDatabase);
        console.log("Temp DB:", newDatabaseName);

        /* ===============================
           4️⃣ FETCH TABLE LIST
        =============================== */

        const tableData = await PLSYS14.findAll({
            where: { S14F06: { [Op.in]: ['Y', 'F'] } },
            attributes: ['S14F02']
        });

        if (!tableData || tableData.length === 0) {
            response.status = "FAIL";
            response.message = "No tables configured for backup";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(404).json({ encryptedResponse });
        }

        /* ===============================
           5️⃣ CREATE TEMP DATABASE
        =============================== */

        // await sequelizeMASTER.query(`
        //     IF DB_ID('${newDatabaseName}') IS NULL
        //     BEGIN
        //         CREATE DATABASE [${newDatabaseName}]
        //     END
        // `);

        /* ===============================
           6️⃣ COPY YEAR TABLES
        =============================== */

        // for (const row of tableData) {

        //     const tablePrefix = row.S14F02.trim();
        //     const sourceTable = `YR${yearNo}${tablePrefix}`;

        //     console.log(`Checking table ${sourceTable}`);

        //     const check = await sequelizeMASTER.query(`
        //         SELECT 1
        //         FROM ${sourceDatabase}.INFORMATION_SCHEMA.TABLES
        //         WHERE TABLE_NAME = '${sourceTable}'
        //     `, {
        //         logging: false
        //     });

        //     if (check[0].length === 0) {
        //         console.log(`Skipping missing table: ${sourceTable}`);
        //         continue;
        //     }

        //     console.log(`Copying ${sourceTable}`);

        //     await sequelizeMASTER.query(`
        //         USE [${newDatabaseName}];

        //         IF OBJECT_ID('${sourceTable}') IS NOT NULL
        //             DROP TABLE ${sourceTable};

        //         SELECT *
        //         INTO ${sourceTable}
        //         FROM ${sourceDatabase}.dbo.${sourceTable};
        //     `, {
        //         logging: false
        //     });
        // }


        const tempDir = path.join("/tmp", "downloads");
        console.log("Temp Diractory", tempDir);


        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // const backupFilePath = path.join(tempDir, `${newDatabaseName}.bak`);

        const backupFolder = path.join(tempDir, newDatabaseName);

        if (!fs.existsSync(backupFolder)) {
            fs.mkdirSync(backupFolder, { recursive: true });
        }

        /* ===============================
   6️⃣ EXPORT TABLES TO SQL FILES
=============================== */

        for (const row of tableData) {

            const tablePrefix = row.S14F02.trim();
            const tableName = `YR${yearNo}${tablePrefix}`;

            console.log(`Processing ${tableName}`);

            const check = await sequelizeMASTER.query(`
        SELECT 1
        FROM ${sourceDatabase}.INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = '${tableName}'
    `);

            if (check[0].length === 0) {
                console.log(`Skipping missing table: ${tableName}`);
                continue;
            }

            await exportTableData(sourceDatabase, tableName, backupFolder);
        }

        /* ===============================
           7️⃣ PREPARE LOCAL BACKUP PATH
        =============================== */

        /* ===============================
           8️⃣ CREATE DATABASE BACKUP
        =============================== */

        // console.log("Creating backup:", backupFilePath);

        // let bkup = await sequelizeMASTER.query(`
        //     BACKUP DATABASE [${newDatabaseName}]
        //     TO DISK = '/var/www/html/eplus/${newDatabaseName}.bak'
        //     WITH FORMAT, INIT
        // `);
        // await downloadFile(newDatabaseName, corporateID)

        /* ===============================
           9️⃣ ZIP BACKUP FILE
        =============================== */

        // const zipFilePath = `${backupFilePath}.zip`;
        // await zipBackupFile(backupFilePath, zipFilePath);

        const zipFilePath = path.join(tempDir, `${newDatabaseName}.zip`);
        await zipFolder(backupFolder, zipFilePath);

        if (!fs.existsSync(zipFilePath)) {
            throw new Error("Zip file creation failed");
        }

        /* ===============================
           🔟 GOOGLE DRIVE AUTH
        =============================== */

        oauth2Client.setCredentials({ refresh_token });

        const root = await getOrCreateFolder("eplus");
        const corp = await getOrCreateFolder(corporateID, root);
        const comp = await getOrCreateFolder(companyID.toString(), corp);

        const zipFileName = path.basename(zipFilePath);
        if (action == 'G') {
            /* ===============================
               1️⃣1️⃣ DELETE OLD FILE FROM DRIVE
            =============================== */

            const existing = await drive.files.list({
                q: `name='${zipFileName}' and '${comp}' in parents and trashed=false`,
                fields: "files(id)"
            });

            for (const f of existing.data.files) {
                await drive.files.delete({ fileId: f.id });
            }

            /* ===============================
               1️⃣2️⃣ UPLOAD TO DRIVE
            =============================== */

            const driveFile = await drive.files.create({
                requestBody: {
                    name: zipFileName,
                    parents: [comp]
                },
                media: {
                    mimeType: "application/zip",
                    body: fs.createReadStream(zipFilePath)
                },
                fields: "id"
            });
            /* ===============================
           1️⃣3️⃣ CLEANUP LOCAL FILES
        =============================== */
            /* ===============================
               1️⃣3️⃣ CLEANUP LOCAL FILES
            =============================== */

            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            if (fs.existsSync(backupFolder)) {
                fs.rmSync(backupFolder, { recursive: true, force: true });
            }
        } else if (action == 'M') {
            // let fName = zipFilePath.split('/');
            const fileName = path.basename(zipFilePath);
            const emails = await getCorporateEmails(corporateID);
            // let mailFile = await sendEmailWithAttachment('developmentoffice71@gmail.com', zipFilePath, fName[fName.length - 1]);
            if (!emails || emails.length === 0) {
                throw new Error("No admin email configured for this corporate");
            }
            for (const email of emails) {
                await sendEmailWithAttachment(
                    email,
                    zipFilePath,
                    // fName[fName.length - 1]
                    fileName
                );
            }
            /* ===============================
           1️⃣3️⃣ CLEANUP LOCAL FILES
        =============================== */

            /* ===============================
       1️⃣3️⃣ CLEANUP LOCAL FILES
    =============================== */

            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            if (fs.existsSync(backupFolder)) {
                fs.rmSync(backupFolder, { recursive: true, force: true });
            }
        }
        // await sequelizeMASTER.query(`
        //     ALTER DATABASE [${newDatabaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        //     DROP DATABASE [${newDatabaseName}];
        //     `, {
        //     type: QueryTypes.RAW,
        //     logging: false,
        //     dialectOptions: {
        //         requestTimeout: 600000 // 10 minutes
        //     }
        // });
        /* ===============================
           1️⃣4️⃣ SUCCESS RESPONSE
        =============================== */

        response.data = {
            corporateID,
            companyID,
            sourceDatabase,
            backupDatabase: newDatabaseName
        };
        response.status = 'SUCCESS';
        response.message = "Financial backup created successfully";

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));

        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        console.error("backupToDrive error:", err);

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));

        return res.status(500).json({ encryptedResponse });

    }
    //  finally {

    //     ftpClient.close();

    // }
};

async function exportTableData(database, tableName, folderPath) {

    const filePath = path.join(folderPath, `${tableName}.sql`);

    // get table data
    const rows = await sequelizeMASTER.query(`
        SELECT * FROM ${database}.dbo.${tableName}
    `);

    if (!rows[0].length) {
        console.log(`No data in ${tableName}`);
        return;
    }

    /* =================================
       CHECK IF TABLE HAS IDENTITY COLUMN
    ================================= */

    const identityCheck = await sequelizeMASTER.query(`
        SELECT name
        FROM ${database}.sys.identity_columns
        WHERE object_id = OBJECT_ID('${database}.dbo.${tableName}')
    `);

    const hasIdentity = identityCheck[0].length > 0;

    let sqlContent = "";

    if (hasIdentity) {
        sqlContent += `SET IDENTITY_INSERT ${tableName} ON;\n\n`;
    }

    /* =================================
       GET COLUMN NAMES
    ================================= */

    const columns = Object.keys(rows[0][0]);

    const columnList = columns.join(",");

    /* =================================
       GENERATE INSERT QUERIES
    ================================= */

    for (let row of rows[0]) {

        const values = columns.map(col => {

            const v = row[col];

            if (v === null) return "NULL";
            if (typeof v === "number") return v;

            return `'${v.toString().replace(/'/g, "''")}'`;

        });

        sqlContent += `INSERT INTO ${tableName} (${columnList}) VALUES (${values.join(",")});\n`;
    }

    if (hasIdentity) {
        sqlContent += `\nSET IDENTITY_INSERT ${tableName} OFF;\n`;
    }

    fs.writeFileSync(filePath, sqlContent);

    console.log(`Created ${filePath}`);
}

function zipFolder(sourceFolder, zipPath) {

    return new Promise((resolve, reject) => {

        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", resolve);
        archive.on("error", reject);

        archive.pipe(output);
        archive.directory(sourceFolder, false);
        archive.finalize();
    });
}

const uploadBackupToFTP1 = async (req, res) => {

    try {

        if (!req.body.pa) {
            return res.json({
                status: "FAIL",
                message: "Missing payload"
            });
        }

        const parameterString = encryptor.decrypt(req.body.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let p1 = JSON.parse(decodedParam);

        const { databaseName } = p1;

        if (!databaseName) {
            return res.json({
                status: "FAIL",
                message: "databaseName required"
            });
        }

        /* CREATE BACKUP DIRECTLY IN FTP STORAGE */

        const backupPath = `/var/www/html/eplus/${databaseName}.bak`;

        const query = `
        BACKUP DATABASE [${databaseName}]
        TO DISK = '${backupPath}'
        WITH FORMAT, INIT, COMPRESSION
        `;

        await sequelizeMASTER.query(query);

        return res.json({
            status: "SUCCESS",
            message: "Backup created directly in FTP storage",
            data: {
                databaseName,
                ftpPath: `/html/eplus/${databaseName}.bak`,
                ftpUrl: `https://s01.lyfexplore.com/eplus/${databaseName}.bak`
            }
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            status: "FAIL",
            message: err.message
        });

    }
};

async function importBackupFromZip(req, res) {
    const parameterString = encryptor.decrypt(req.body.pa);
    const decodedParam = decodeURIComponent(parameterString);
    const p1 = JSON.parse(decodedParam);

    // Token validation
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            status: "FAIL",
            message: "Authorization token missing"
        });
    }

    const decoded = await validateToken(token);
    if (!decoded || !decoded.corpId) {
        return res.status(401).json({
            status: "FAIL",
            message: "Invalid token or corporateID missing"
        });
    }

    const corporateID = decoded.corpId;
    const targetDB = generateDatabaseName(corporateID, p1.companyID);
    if (!targetDB) {
        return res.status(400).json({ error: 'Target database not specified' });
    }

    const file = req.files[0];
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (path.extname(file.originalname) !== '.zip') {
        return res.status(400).json({ error: 'Uploaded file is not a .zip file' });
    }

    const zipPath = path.join(__dirname, "..", "downloads", file.originalname);
    const extractPath = path.join(__dirname, "..", "downloads", file.originalname.replace('.zip', ''));

    try {
        // Save the uploaded file first to the temp location
        await fs.promises.writeFile(zipPath, file.buffer);

        // Check if the file exists after saving
        if (!fs.existsSync(zipPath)) {
            return res.status(400).json({ error: `The file ${zipPath} does not exist.` });
        }

        // Extract ZIP
        await fs.promises.mkdir(extractPath, { recursive: true });
        const zipStream = fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractPath }));

        await new Promise((resolve, reject) => {
            zipStream.on('close', resolve);
            zipStream.on('error', reject);
        });

        const sqlFiles = fs.readdirSync(extractPath).filter(file => path.extname(file) === '.sql');
        if (sqlFiles.length === 0) {
            return res.status(400).json({ error: 'No .sql files found in the zip archive' });
        }

        // Step 1: Extract table names from filenames and check if tables exist in the database
        const tableCheckPromises = sqlFiles.map(async (sqlFile) => {
            const tableName = path.basename(sqlFile, '.sql'); // Extract table name from file name

            // Use db.getConnection(targetDB) to connect to the target database
            const dbConn = db.getConnection(targetDB);

            try {
                // Query to check if the table exists in the target database
                const result = await dbConn.query(`
                    SELECT COUNT(*) AS TableCount
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = '${tableName}' AND TABLE_CATALOG = '${targetDB}'
                `, {
                    replacements: { tableName, targetDB },
                    type: QueryTypes.SELECT
                });

                return { tableName, tableExists: result[0].TableCount > 0 };
            } catch (err) {
                console.error(`Error checking if table ${tableName} exists:`, err);
                return { tableName, tableExists: false };  // If error occurs, assume table does not exist
            }
        });

        const tableChecks = await Promise.all(tableCheckPromises);

        // If any table doesn't exist, abort and inform the user
        const missingTables = tableChecks.filter(check => !check.tableExists).map(check => check.tableName);
        if (missingTables.length > 0) {
            return res.status(400).json({
                error: `The following tables do not exist in the database: ${missingTables.join(', ')}`
            });
        }

        // Step 2: If all tables exist, execute the SQL scripts
        for (let sqlFile of sqlFiles) {
            const sqlFilePath = path.join(extractPath, sqlFile);
            const sqlScript = fs.readFileSync(sqlFilePath, 'utf-8');

            try {
                 const dbConn = db.getConnection(targetDB);  // Get the connection again to execute queries
                await dbConn.query(`USE ${targetDB}; ${sqlScript}`, { type: QueryTypes.RAW });
                fs.unlinkSync(sqlFilePath);
            } catch (error) {
                console.error(`Error executing SQL script from ${sqlFile}:`, error);
                return res.status(500).json({ error: `Error executing SQL: ${error.message}` });
            }
        }

        // Cleanup
        fs.rmSync(extractPath, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        return res.status(200).json({ message: 'SQL scripts executed successfully!' });

    } catch (error) {
        console.error('Error processing ZIP file:', error);
        return res.status(500).json({ error: `Error processing the ZIP file: ${error.message}` });
    }
}

module.exports = { backupZipToDrive, uploadBackupToFTP1, importBackupFromZip };
