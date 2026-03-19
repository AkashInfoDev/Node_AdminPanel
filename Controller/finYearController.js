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
const csvParser = require("csv-parser");
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
const { error } = require('console');
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
        await exportCMPF01Data(sourceDatabase, backupFolder, yearNo);
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


        
        const zipFileName = path.basename(zipFilePath);
        if (action == 'G') {
            oauth2Client.setCredentials({ refresh_token });
            const root = await getOrCreateFolder("eplus");
            const corp = await getOrCreateFolder(corporateID, root);
            const comp = await getOrCreateFolder(companyID.toString(), corp);
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

async function exportCMPF01Data(database, folderPath, yeNo) {
    const tableName = "CMPF01";
    const filePath = path.join(folderPath, `CMPF01.csv`);

    // Fetch only rows where FIELD01 = 25
    const [rows] = await sequelizeMASTER.query(
        `SELECT * FROM ${database}.dbo.CMPF01 WHERE FIELD01 = ${yeNo}`
    );

    if (!rows.length) {
        console.log(`No data found in CMPF01 with FIELD01 = ${yeNo}`);
        return;
    }

    // Get column names for header
    const columns = Object.keys(rows[0]);
    const header = columns.join(",") + "\n";

    // Convert rows to CSV format
    const csvContent = rows
        .map(row => {
            return columns
                .map(col => {
                    const val = row[col];
                    if (val === null) return "";
                    if (typeof val === "string") {
                        // Escape quotes by doubling them
                        return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val;
                })
                .join(",");
        })
        .join("\n");

    // Write to file
    fs.writeFileSync(filePath, header + csvContent);

    console.log(`CMPF01 data exported to ${filePath}`);
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

    if (path.extname(file.originalname) !== '.zip') {
        return res.status(400).json({ error: 'Uploaded file is not a .zip file' });
    }

    const zipPath = path.join("/tmp", file.originalname);
    const extractPath = path.join("/tmp", file.originalname.replace('.zip', ''));
    // Postfix table lists
    const datePostfixTables = ['T07', 'T02', 'T05', 'T11', 'T50', 'T82', 'T17', 'T06', 'T01', 'T41'];
    const uniquePostfixTables = ['M01', 'M21'];

    try {
        // Save uploaded zip
        await fs.promises.writeFile(zipPath, file.buffer);

        if (!fs.existsSync(zipPath)) {
            return { status: 400, message: `The file ${zipPath} does not exist.` };
        }

        // Extract ZIP
        await fs.promises.mkdir(extractPath, { recursive: true });
        const zipStream = fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractPath }));

        await new Promise((resolve, reject) => {
            zipStream.on("close", resolve);
            zipStream.on("error", reject);
        });

        const files = fs.readdirSync(extractPath);

        // Step 0: Validate CSV if exists and get financial year
        const csvFiles = files.filter(f => path.extname(f) === ".csv");
        if (csvFiles.length === 0) {
            return res.status(400).json({ error: 'No CSV file found for financial year.' });
        }

        const csvPath = path.join(extractPath, csvFiles[0]);
        let financialYearStart, financialYearEnd;

        const csvRows = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(csvPath)
                .pipe(csvParser())
                .on("data", (row) => csvRows.push(row))
                .on("end", resolve)
                .on("error", reject);
        });

        for (let row of csvRows) {
            const field01 = row.FIELD01;
            const field02 = row.FIELD02;
            const field03 = row.FIELD03;

            const [dbRow] = await sequelizeMASTER.query(
                `SELECT FIELD02, FIELD03 FROM ${targetDB}.dbo.CMPF01 WHERE FIELD01 = :field01`,
                { replacements: { field01 }, type: QueryTypes.SELECT }
            );

            if (!dbRow) throw new Error(`FIELD01=${field01} not found in database.`);

            const csvStart = csvRows[0].FIELD02;
            const csvEnd = csvRows[0].FIELD03;
            const dbStart = dbRow.FIELD02;
            const dbEnd = dbRow.FIELD03;

            const exactMatch = csvStart === dbStart && csvEnd === dbEnd;
            const rangeInside = csvStart >= dbStart && csvEnd <= dbEnd;

            if (!exactMatch && !rangeInside) {
                const response = { status: 'FAIL', message: "Financial Date Mismatched." };
                const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse });
            }
        }

        financialYearStart = csvRows[0].FIELD02;
        financialYearEnd = csvRows[0].FIELD03;

        console.log(`Financial year: ${financialYearStart} - ${financialYearEnd}`);
        console.log("CSV validation completed successfully.");

        // Step 1: Check tables exist
        const sqlFiles = files.filter(f => path.extname(f) === ".sql");
        if (sqlFiles.length === 0) {
            return { status: 400, message: "No .sql files found in the zip archive" };
        }

        const tableCheckPromises = sqlFiles.map(async (sqlFile) => {
            const tableName = path.basename(sqlFile, ".sql");
            const dbConn = db.getConnection(targetDB);
            try {
                const result = await dbConn.query(
                    `SELECT COUNT(*) AS TableCount
                     FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_NAME = '${tableName}' AND TABLE_CATALOG = '${targetDB}'`,
                    { type: QueryTypes.SELECT }
                );
                return { tableName, tableExists: result[0].TableCount > 0 };
            } catch (err) {
                console.error(`Error checking table ${tableName}:`, err);
                return { tableName, tableExists: false };
            }
        });

        const tableChecks = await Promise.all(tableCheckPromises);
        const missingTables = tableChecks.filter(check => !check.tableExists).map(check => check.tableName);
        if (missingTables.length > 0) {
            return { status: 400, message: `Missing tables: ${missingTables.join(", ")}` };
        }

        // Step 2: Filter and execute SQL scripts
        for (let sqlFile of sqlFiles) {
            const sqlFilePath = path.join(extractPath, sqlFile);
            let sqlScript = fs.readFileSync(sqlFilePath, "utf-8");
            const tableName = path.basename(sqlFile, '.sql').slice(-3); // last 3 chars as postfix

            const filteredSQL = filterInsertStatements(sqlScript, tableName, datePostfixTables, uniquePostfixTables, financialYearStart, financialYearEnd);

            if (filteredSQL.trim()) {
                try {
                    const dbConn = db.getConnection(targetDB);
                    await dbConn.query(`USE ${targetDB}; ${filteredSQL}`, { type: QueryTypes.RAW });
                    if (tableName.includes('M01')) {
                        let tabName = filteredSQL.split(' ');
                        await dbConn.query(
                            `SELECT FIELD02, COUNT(*) AS duplicate_count
                        FROM ${tabName[2]}
                        GROUP BY FIELD02
                        HAVING COUNT(*) > 1;
                        
                        WITH CTE AS (
                        SELECT *,
                        ROW_NUMBER() OVER (PARTITION BY FIELD02 ORDER BY (SELECT 0)) AS rn
                        FROM ${tabName[2]}
                        )
                        DELETE FROM CTE
                        WHERE rn > 1;`,
                            { type: QueryTypes.RAW }
                        );
                    } else if (tableName.includes('M21')) {
                        let tabName = filteredSQL.split(' ');
                        await dbConn.query(
                            `SELECT FIELD02, COUNT(*) AS duplicate_count
                            FROM ${tabName[2]}
                            GROUP BY FIELD02
                            HAVING COUNT(*) > 1;
                            
                            WITH CTE AS (
                            SELECT *,
                            ROW_NUMBER() OVER (PARTITION BY FIELD02 ORDER BY (SELECT 0)) AS rn
                            FROM ${tabName[2]}
                            )
                            DELETE FROM CTE
                            WHERE rn > 1;`,
                            { type: QueryTypes.RAW }
                        );
                    }
                    fs.unlinkSync(sqlFilePath);
                    console.log(`Executed ${sqlFile} successfully.`);
                } catch (err) {
                    console.log(err);
                    return { status: 500, message: `Error executing SQL ${sqlFile}: ${err.message}` };
                }
            } else {
                console.log(`Skipping ${sqlFile}: no valid rows to insert`);
            }
        }

        // Cleanup
        fs.rmSync(extractPath, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        const response = { status: 'SUCCESS', message: "Financial year restored successfully" };
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });

    } catch (error) {
        console.error('Error processing ZIP file:', error);
        return res.status(500).json({ error: `Error processing the ZIP file: ${error.message}` });
    }
}

/**
 * Filters INSERT statements based on table rules
 */
function filterInsertStatements(sqlScript, tableName, dateTables, uniqueTables, startDate, endDate) {
    const insertStatements = sqlScript.split(/;\s*INSERT INTO/i)
        .map((stmt, i) => i === 0 ? stmt : 'INSERT INTO ' + stmt)
        .filter(stmt => stmt.trim() !== '');

    const filteredStatements = insertStatements.map(stmt => {
        if (dateTables.includes(tableName)) {
            const seen = new Set(); // track FLDUNQ

            return stmt.replace(/INSERT INTO\s+\S+\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\);?/gi, (fullMatch, colNames, valuesBlock) => {
                // Get array of column names
                const columns = colNames.split(',').map(c => c.trim());

                // Identify indexes for FLDUNQ and FIELD02 dynamically
                const fldUnqIndex = columns.findIndex(c => c.toUpperCase() === 'FLDUNQ');
                const fieldDateIndex = columns.findIndex(c => c.toUpperCase() === 'FIELD02');

                if (fldUnqIndex === -1 || fieldDateIndex === -1) return ''; // skip if essential columns missing

                // Split multiple rows: "),(" is the separator
                const rows = valuesBlock.split(/\),\s*\(/).map(r => r.replace(/^[(]|[)]$/g, '').trim());

                const filteredRows = rows.filter(row => {
                    if (!row) return false; // skip empty rows

                    // Split row safely respecting quotes
                    const rowValues = row.match(/'[^']*'|[^,]+/g).map(v => v.trim());

                    const fldUnq = rowValues[fldUnqIndex].replace(/'/g, '').trim();
                    const fieldDate = parseInt(rowValues[fieldDateIndex].replace(/'/g, '').trim());

                    // Date filter
                    if (fieldDate < startDate || fieldDate > endDate) return false;

                    // Uniqueness filter (except T05)
                    if (tableName !== 'T05') {
                        if (seen.has(fldUnq)) return false;
                        seen.add(fldUnq);
                    }

                    return true;
                });

                if (filteredRows.length === 0) return ''; // remove entire INSERT if no rows left

                return `${fullMatch.match(/INSERT INTO\s+\S+/i)[0]} (${columns.join(',')}) VALUES (${filteredRows.join('),(')});`;
            });
        } else if (uniqueTables.includes(tableName)) {

            const seen = new Set();

            return stmt.replace(/\((.*?)\)/g, (match, values) => {
                const rows = values.split(/\),\s*\(/).map(v => v.replace(/^[(]|[)]$/g, ''));

                const filteredRows = rows.filter(row => {
                    const field02 = row.includes(',')
                        ? row.split(',')[1].replace(/'/g, '').trim()
                        : row;

                    if (seen.has(field02)) return false;
                    seen.add(field02);
                    return true;
                });

                if (filteredRows.length === 0) return null;

                return '(' + filteredRows.join('),(') + ')';
            }).replace(/\(\)/g, '');

        } else {
            return stmt;
        }
    });

    return filteredStatements.filter(s => s && s.trim() !== '').join(';\n');
}

module.exports = { backupZipToDrive, uploadBackupToFTP1, importBackupFromZip };
