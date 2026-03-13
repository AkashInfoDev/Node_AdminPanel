const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const archiver = require('archiver');
const sql = require('mssql'); // Assuming SQL Server as the database
const { google } = require('googleapis');
const { validateToken } = require('../Services/tokenServices');
const db = require("../Config/config");
const AdmZip = require('adm-zip');
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

    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;

    try {

        /* ===============================
           1️⃣ PAYLOAD VALIDATION
        =============================== */

        if (!req.body.pa) {
            return res.status(400).json({
                status: "FAIL",
                message: "Missing payload"
            });
        }

        const parameterString = encryptor.decrypt(req.body.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const p1 = JSON.parse(decodedParam);

        const { companyID, yearNo, refresh_token, action } = p1;

        if (!companyID || !yearNo || !refresh_token) {
            return res.status(400).json({
                status: "FAIL",
                message: "companyID, yearNo and refresh_token required"
            });
        }

        /* ===============================
           2️⃣ TOKEN VALIDATION
        =============================== */

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

        console.log(tableData);


        if (!tableData || tableData.length === 0) {
            return res.status(404).json({
                status: "FAIL",
                message: "No tables configured for backup"
            });
        }

        /* ===============================
           5️⃣ CREATE TEMP DATABASE
        =============================== */

        await sequelizeMASTER.query(`
            IF DB_ID('${newDatabaseName}') IS NULL
            BEGIN
                CREATE DATABASE [${newDatabaseName}]
            END
        `);

        /* ===============================
           6️⃣ COPY YEAR TABLES
        =============================== */

        for (const row of tableData) {

            const tablePrefix = row.S14F02.trim();
            const sourceTable = `YR${yearNo}${tablePrefix}`;

            console.log(`Checking table ${sourceTable}`);

            const check = await sequelizeMASTER.query(`
                SELECT 1
                FROM ${sourceDatabase}.INFORMATION_SCHEMA.TABLES
                WHERE TABLE_NAME = '${sourceTable}'
            `);

            if (check[0].length === 0) {
                console.log(`Skipping missing table: ${sourceTable}`);
                continue;
            }

            console.log(`Copying ${sourceTable}`);

            await sequelizeMASTER.query(`
                USE [${newDatabaseName}];

                IF OBJECT_ID('${sourceTable}') IS NOT NULL
                    DROP TABLE ${sourceTable};

                SELECT *
                INTO ${sourceTable}
                FROM ${sourceDatabase}.dbo.${sourceTable};
            `);
        }

        /* ===============================
           7️⃣ PREPARE LOCAL BACKUP PATH
        =============================== */

        const tempDir = path.join(__dirname, "../downloads");

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const backupFilePath = path.join(tempDir, `${newDatabaseName}.bak`);

        /* ===============================
           8️⃣ CREATE DATABASE BACKUP
        =============================== */

        console.log("Creating backup:", backupFilePath);

        let bkup = await sequelizeMASTER.query(`
            BACKUP DATABASE [${newDatabaseName}]
            TO DISK = '/var/www/html/eplus/${newDatabaseName}.bak'
            WITH FORMAT, INIT
        `);
        await downloadFile(newDatabaseName, corporateID)
        console.log(bkup);

        /* ===============================
           9️⃣ ZIP BACKUP FILE
        =============================== */

        const zipFilePath = `${backupFilePath}.zip`;

        await zipBackupFile(backupFilePath, zipFilePath);

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

            if (fs.existsSync(backupFilePath)) {
                fs.unlinkSync(backupFilePath);
            }

            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
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

            if (fs.existsSync(backupFilePath)) {
                fs.unlinkSync(backupFilePath);
            }

            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }
        }

        await sequelizeMASTER.query(`DROP DATABASE ${newDatabaseName}`, {
            type: QueryTypes.RAW
        })
        /* ===============================
           1️⃣4️⃣ SUCCESS RESPONSE
        =============================== */

        return res.json({
            status: "SUCCESS",
            message: "Financial backup uploaded",
            data: {
                corporateID,
                companyID,
                sourceDatabase,
                backupDatabase: newDatabaseName
            }
        });

    } catch (err) {

        console.error("backupToDrive error:", err);

        return res.status(500).json({
            status: "FAIL",
            message: err
        });

    }
    //  finally {

    //     ftpClient.close();

    // }
};

const downloadFile = async (newDatabaseName, corporateID) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;  // Set to `false` to hide FTP commands for cleaner logs

    try {
        // Fetch FTP details from the database (replace with your logic)
        let FTPdetail = await PLRDBA01.findOne({
            where: {
                A01F03: corporateID // Assuming you're using `this.decoded.corpId` here
            }
        });

        if (!FTPdetail) {
            console.error("FTP details not found for the given corpId");
            return;
        }

        // Connect to the FTP server (no credentials needed)
        await client.access({
            host: FTPdetail.FTPURL,     // FTP server hostname
            user: FTPdetail.FTPUID,       // FTP username
            password: FTPdetail.FTPPWD,   // FTP password
            secure: false,                   // Set to `true` if using FTPS
        });

        // Define the remote and local file paths
        const remoteFilePath = `/html/eplus/${newDatabaseName}.bak`;  // Adjust path as needed
        const localFilePath = `./downloads/${newDatabaseName}.bak`;   // Local path where you want to save the file
        const localDir = path.dirname(localFilePath);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        // Download file from the FTP server
        let downloadStatus = await client.downloadTo(localFilePath, remoteFilePath);
        console.log(`File successfully downloaded to ${localFilePath}`);

        // If download was successful, remove the file from the FTP server
        if (downloadStatus) {
            await client.remove(remoteFilePath);  // Remove the file from the FTP server
            console.log(`File successfully removed from FTP server: ${remoteFilePath}`);
        }
    } catch (error) {
        console.error("Error accessing FTP server:", error);
    } finally {
        // Ensure the client is closed after the operation
        client.close();
    }
};

function zipBackupFile(backupFilePath, zipFilePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(backupFilePath)) {
            return reject(new Error(`Backup file not found at: ${backupFilePath}`));
        }

        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Highest compression level
        });

        output.on('close', function () {
            console.log(`Backup file successfully zipped: ${zipFilePath}`);
            resolve();
        });

        archive.on('error', function (err) {
            console.error('Error creating zip file:', err);
            reject(err);
        });

        archive.pipe(output);
        archive.append(fs.createReadStream(backupFilePath), { name: path.basename(backupFilePath) });
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

async function importBackupFromZip(zipFilePath, targetDB) {
    // Step 1: Extract .bak from zip
    const zip = new AdmZip(zipFilePath);
    const bakEntry = zip.getEntries().find(e => path.extname(e.entryName) === '.bak');
    if (!bakEntry) throw new Error('No .bak file found in the zip');

    const bakPath = path.join(__dirname, '..', 'uploads', bakEntry.entryName);
    zip.extractEntryTo(bakEntry, path.join(__dirname, '..', 'uploads'), false, true);

    // Step 2: Connect to SQL Server
    const pool = await sql.connect(config);

    const tempDB = `TempRestoreDB_${Date.now()}`;

    try {
        // Step 3: Get logical file names from .bak
        const fileList = await pool.request().query(`
            RESTORE FILELISTONLY FROM DISK = '${bakPath}'
        `);

        const dataFile = fileList.recordset.find(f => f.Type === 'D').LogicalName;
        const logFile = fileList.recordset.find(f => f.Type === 'L').LogicalName;

        // Step 4: Restore temp database
        await pool.request().query(`
            RESTORE DATABASE [${tempDB}]
            FROM DISK = '${bakPath}'
            WITH MOVE '${dataFile}' TO 'C:\\SQLData\\${tempDB}.mdf',
                 MOVE '${logFile}' TO 'C:\\SQLData\\${tempDB}_log.ldf',
                 REPLACE
        `);

        // Step 5: Get list of tables in temp DB
        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM [${tempDB}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);

        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);

        // Step 6: Check if all tables exist in target DB
        const checkTablesResult = await pool.request().query(`
            SELECT TABLE_NAME
            FROM [${targetDB}].INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(',')})
        `);

        const existingTables = checkTablesResult.recordset.map(r => r.TABLE_NAME);

        if (existingTables.length !== tables.length) {
            throw new Error('Some tables in backup do not exist in target database');
        }

        // Step 7: Insert data
        for (let table of tables) {
            await pool.request().query(`
                INSERT INTO [${targetDB}].dbo.[${table}]
                SELECT * FROM [${tempDB}].dbo.[${table}]
            `);
        }

        return 'Data imported successfully!';
    } finally {
        // Step 8: Clean up temp database
        await pool.request().query(`DROP DATABASE IF EXISTS [${tempDB}]`);
        fs.unlinkSync(zipFilePath);
        fs.existsSync(bakPath) && fs.unlinkSync(bakPath);
    }
}

module.exports = { backupZipToDrive, uploadBackupToFTP1, importBackupFromZip };
