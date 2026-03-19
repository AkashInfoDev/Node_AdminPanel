const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { google } = require("googleapis");
const { validateToken } = require('../Services/tokenServices');
const db = require("../Config/config");
const sequelizeMASTER = db.getConnection("MASTER");
const Encryptor = require("../Services/encryptor");
const { QueryTypes } = require("sequelize");
const { Readable } = require("stream");
const unzipper = require("unzipper");
const encryptor = new Encryptor();

/* ================= GOOGLE OAUTH ================= */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const drive = google.drive({ version: "v3", auth: oauth2Client });

/* ================= ZIP HELPER ================= */
function zipFiles(files, zipPath) {
    return new Promise((resolve, reject) => {
        console.log("📦 ZIP START:", zipPath);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
            console.log("✅ ZIP CREATED:", zipPath);
            resolve();
        });

        archive.on("error", (err) => {
            console.error("❌ ZIP ERROR:", err);
            reject(err);
        });

        archive.pipe(output);

        files.forEach(f => {
            console.log("➕ Adding to ZIP:", f.name);
            archive.file(f.path, { name: f.name });
        });

        archive.finalize();
    });
}
/* ================= DRIVE FOLDER ================= */
async function getOrCreateFolder(name, parentId = null) {

    console.log("📁 Checking/Creating folder:", name);

    const q = [
        `name='${name}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        parentId ? `'${parentId}' in parents` : null,
        "trashed=false"
    ].filter(Boolean).join(" and ");

    const res = await drive.files.list({
        q,
        fields: "files(id,name)"
    });

    if (res.data.files.length) {
        console.log("📁 Folder exists:", name);
        return res.data.files[0].id;
    }

    console.log("📁 Creating folder:", name);

    const folder = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : []
        },
        fields: "id"
    });

    console.log("✅ Folder created:", name);

    return folder.data.id;
}
/* ================= BRANCH FETCH ================= */
async function getCompanyBranches(corporateID, companyID) {

    console.log("🔍 Fetching corpUnq for:", corporateID);

    const corp = await db.getConnection("RDB").query(`
        SELECT A01F01 FROM PLRDBA01 WHERE A01F03 = :corporateID
    `, {
        replacements: { corporateID },
        type: QueryTypes.SELECT
    });

    if (!corp.length) throw new Error("Corporate not found");

    const corpUnq = corp[0].A01F01.trim();
    console.log("✅ corpUnq:", corpUnq);

    const parts = corporateID.split('-');
    let sdbName =
        parts.length === 3
            ? `${parts[0]}${parts[1]}${parts[2]}SDB`
            : `${parts[0]}${parts[1]}SDB`;

    if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';

    console.log("📂 Using SDB:", sdbName);

    const sequelizeSDB = db.getConnection(sdbName);

    const branches = await sequelizeSDB.query(`
        SELECT BRCODE, BRNAME, BRGST, BRCCOMP
        FROM PLSDBBRC
        WHERE BRCORP = :corpUnq
    `, {
        replacements: { corpUnq },
        type: QueryTypes.SELECT
    });

    console.log("📊 Total branches fetched:", branches.length);

    const filtered = branches.filter(b => {
        if (!b.BRCCOMP) return false;

        const list = b.BRCCOMP.split(',').map(x => x.trim());

        return list.includes(companyID.toString()) ||
            list.includes(companyID.toString().padStart(4, '0'));
    });

    console.log("✅ Filtered branches:", filtered.length);

    return filtered.map(b => ({
        BRCODE: b.BRCODE,
        BRNAME: b.BRNAME,
        BRGST: b.BRGST
    }));
}

/* ================= MAIN API ================= */
const backupToDrive = async (req, res) => {

    console.log("🚀 API HIT");

    let response = { data: null, message: '', status: 'Success' };
    let encryptedResponse;

    const ftpClient = new ftp.Client();

    try {

        /* ========= PAYLOAD ========= */
        console.log("🔐 Decrypting payload...");
        const p1 = JSON.parse(
            decodeURIComponent(encryptor.decrypt(req.body.pa))
        );

        const { companyID, googledrive_token } = p1;
        console.log("📥 Payload:", p1);

        /* ========= TOKEN ========= */
        const token = req.headers.authorization?.split(" ")[1];
        const decoded = await validateToken(token);

        const corporateID = decoded.corpId;
        console.log("👤 CorporateID:", corporateID);

        /* ========= DB ========= */
        const databaseName = `A${corporateID.slice(-5)}CMP${companyID.toString().padStart(4, "0")}`;
        const fileName = `${databaseName}.bak`;

        console.log("🗄 Database:", databaseName);

        const ftpFolderPath = `/html/eplus/`;
        const remoteBackupPath = `/var/www${ftpFolderPath}${fileName}`;

        /* ========= GOOGLE AUTH ========= */
        console.log("🔑 Setting Google token...");
        oauth2Client.setCredentials({
            refresh_token: googledrive_token
        });

        /* ========= FTP ========= */
        console.log("🌐 Connecting FTP...");
        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        console.log("✅ FTP Connected");

        /* ========= BACKUP ========= */
        console.log("📦 Creating SQL Backup...");
        await sequelizeMASTER.query(`
            BACKUP DATABASE [${databaseName}]
            TO DISK = '${remoteBackupPath}'
            WITH FORMAT, INIT, COMPRESSION, COPY_ONLY
        `);

        console.log("✅ Backup Created");

        /* ========= DOWNLOAD ========= */
        // const localDir = path.resolve("tmp", "downloads");
        const localDir = path.join("..", "..", "..", '/tmp', "downloads", fileName); // Temporary path for downloading
        await fs.promises.mkdir(localDir, { recursive: true });

        const bakPath = path.join(localDir, fileName);

        console.log("⬇ Downloading BAK to:", bakPath);

        await ftpClient.downloadTo(bakPath, `/html/eplus/${fileName}`);

        console.log("✅ BAK Downloaded");

        /* ========= JSON ========= */
        console.log("🧾 Creating JSON...");
        const branches = await getCompanyBranches(corporateID, companyID);

        const jsonPath = path.join(localDir, `${databaseName}.json`);

        await fs.promises.writeFile(
            jsonPath,
            JSON.stringify({ corporateID, companyID, branches }, null, 2)
        );

        console.log("✅ JSON Created:", jsonPath);

        /* ========= ZIP ========= */
        const zipPath = path.join(localDir, `${databaseName}.zip`);

        await zipFiles([
            { path: bakPath, name: fileName },
            { path: jsonPath, name: "metadata.json" }
        ], zipPath);

        if (!fs.existsSync(zipPath)) {
            throw new Error("ZIP NOT CREATED");
        }

        /* ========= DRIVE ========= */
        console.log("☁️ Preparing Drive upload...");

        const root = await getOrCreateFolder("eplus");
        const corp = await getOrCreateFolder(corporateID, root);
        const comp = await getOrCreateFolder(companyID.toString(), corp);


        /* ========= DELETE OLD ZIP IF EXISTS ========= */
        console.log("🗑 Checking existing ZIP on Drive...");

        const existingFiles = await drive.files.list({
            q: `name='${databaseName}.zip' and '${comp}' in parents and trashed=false`,
            fields: "files(id, name)"
        });

        if (existingFiles.data.files.length > 0) {
            console.log(`⚠ Found ${existingFiles.data.files.length} existing file(s), deleting...`);

            for (const file of existingFiles.data.files) {
                await drive.files.delete({ fileId: file.id });
                console.log(`🗑 Deleted: ${file.id}`);
            }
        } else {
            console.log("✅ No existing ZIP found");
        }

        console.log("🚀 Uploading ZIP...");

        const uploaded = await drive.files.create({
            requestBody: {
                name: `${databaseName}.zip`,
                parents: [comp]
            },
            media: {
                mimeType: "application/zip",
                body: fs.createReadStream(zipPath)
            }
        });

        console.log("✅ Uploaded File ID:", uploaded.data.id);
        console.log("🔗 File Link:");
        console.log(`https://drive.google.com/file/d/${uploaded.data.id}/view`);

        /* ========= CLEANUP ========= */
        console.log("🧹 Cleaning up...");

        try {
            await ftpClient.remove(`/html/eplus/${fileName}`);
        } catch (err) {
            console.log("⚠ FTP delete warning:", err.message);
        }

        [bakPath, jsonPath, zipPath].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });

        console.log("✅ Cleanup done");

        response.status = "SUCCESS";
        response.message = "Backup ZIP uploaded successfully";

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        console.error("❌ FULL ERROR:", err);

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(500).json({ encryptedResponse });

    } finally {
        console.log("🔚 Closing FTP");
        ftpClient.close();
    }
};


// for restore using .bak file
// const restoreBak = async (req, res) => {

//     let response = { status: "SUCCESS", message: "", data: null };
//     let encryptedResponse;

//     const ftpClient = new ftp.Client();

//     try {

//         console.log("🚀 BAK Restore API HIT");

//         /* ========= PAYLOAD ========= */
//         const p1 = JSON.parse(
//             decodeURIComponent(encryptor.decrypt(req.body.pa))
//         );

//         /* ========= TOKEN ========= */
//         const authHeader = req.headers.authorization;
//         if (!authHeader) throw new Error("Authorization header missing");

//         const token = authHeader.split(" ")[1];
//         if (!token) throw new Error("Token missing");

//         const decoded = await validateToken(token);
//         console.log("🔍 Decoded Token:", decoded);

//         if (!decoded || !decoded.corpId) {
//             throw new Error("Invalid token or corpId missing");
//         }

//         const corporateID = decoded.corpId;
//         console.log("👤 CorporateID:", corporateID);

//         /* ========= GET SDB ========= */
//         const parts = corporateID.split('-');

//         let sdbName =
//             parts.length === 3
//                 ? `${parts[0]}${parts[1]}${parts[2]}SDB`
//                 : `${parts[0]}${parts[1]}SDB`;

//         if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';

//         console.log("📂 SDB:", sdbName);

//         const sequelizeSDB = db.getConnection(sdbName);

//         /* ========= GET NEXT COMPANY ========= */
//         const result = await sequelizeSDB.query(`
//             SELECT ISNULL(MAX(CMPF01), 0) + 1 AS nextCompany
//             FROM PLSDBCMP
//         `, { type: QueryTypes.SELECT });

//         const nextCompanyID = result[0].nextCompany;
//         console.log("🆕 Next Company ID:", nextCompanyID);

//         /* ========= FILE ========= */
//         const file = req.files[0];

//         if (!file) throw new Error("No .bak file uploaded");
//         if (path.extname(file.originalname) !== '.bak') {
//             throw new Error("Only .bak file allowed");
//         }

//         /* ========= FTP CONNECT ========= */
//         console.log("🌐 Connecting FTP...");
//         await ftpClient.access({
//             host: process.env.FTP_HOST,
//             user: process.env.FTP_USER,
//             password: process.env.FTP_PASS,
//             secure: false
//         });
//         console.log("✅ FTP Connected");

//         /* ========= UNIQUE FILE NAME ========= */
//         const remoteFileName = `${Date.now()}_${file.originalname}`;
//         const remoteFtpPath = `/html/eplus/${remoteFileName}`;
//         const sqlPath = `/var/www/html/eplus/${remoteFileName}`;

//         console.log("⬆ Uploading to FTP:", remoteFtpPath);

//         const stream = Readable.from(file.buffer);
//         await ftpClient.uploadFrom(stream, remoteFtpPath);

//         console.log("✅ Uploaded to FTP");

//         /* ========= NEW DB NAME ========= */
//         const newDatabaseName =
//             `A${corporateID.slice(-5)}CMP${nextCompanyID.toString().padStart(4, "0")}`;

//         console.log("🆕 Final DB Name:", newDatabaseName);

//         /* ========= DROP IF EXISTS ========= */
//         await sequelizeMASTER.query(`
//             IF DB_ID('${newDatabaseName}') IS NOT NULL
//             BEGIN
//                 ALTER DATABASE [${newDatabaseName}] 
//                 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
//                 DROP DATABASE [${newDatabaseName}];
//             END
//         `);

//         /* ========= GET LOGICAL FILE ========= */
//         const fileList = await sequelizeMASTER.query(`
//             RESTORE FILELISTONLY 
//             FROM DISK = '${sqlPath}'
//         `);

//         const dataFile = fileList[0].find(f => f.Type === 'D');
//         const logFile = fileList[0].find(f => f.Type === 'L');

//         if (!dataFile || !logFile) {
//             throw new Error("Invalid BAK file");
//         }

//         console.log("📄 Logical Names:", dataFile.LogicalName, logFile.LogicalName);

//         /* ========= RESTORE ========= */
//         await sequelizeMASTER.query(`
//             RESTORE DATABASE [${newDatabaseName}]
//             FROM DISK = '${sqlPath}'
//             WITH 
//                 MOVE '${dataFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}.mdf',
//                 MOVE '${logFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}_log.ldf',
//                 REPLACE
//         `);

//         console.log("✅ DB Restored Successfully");

//         /* ========= GET COMPANY NAME ========= */
//         const [cmpData] = await sequelizeMASTER.query(`
//             SELECT TOP 1 FIELD02 as companyName
//             FROM ${newDatabaseName}.dbo.CMPM00
//         `, { type: QueryTypes.SELECT });

//         const companyName = cmpData?.companyName || `Company ${nextCompanyID}`;
//         console.log("🏢 Company Name:", companyName);

//         /* ========= INSERT INTO PLSDBCMP ========= */
//         await sequelizeSDB.query(`
//             INSERT INTO PLSDBCMP (
//                 CMPF01, CMPF02, CMPF03, CMPF04,
//                 CMPF11, CMPF12, CMPF21, CMPF22, CMPF23, CMPF24
//             )
//             VALUES (
//                 :companyID, :companyName, 'SQL', 'No Group',
//                 'U0000000', GETDATE(),
//                 '94.176.235.105',
//                 'aipharma_aakash',
//                 'Aipharma@360',
//                 'DATA'
//             )
//         `, {
//             replacements: {
//                 companyID: nextCompanyID,
//                 companyName
//             }
//         });

//         console.log("✅ Inserted into PLSDBCMP");

//         /* ========= INSERT INTO PLSDBM82 ========= */
//         await sequelizeSDB.query(`
//             INSERT INTO PLSDBM82 (
//                 M82F01, M82F02, M82CMP, M82YRN, M82ADA
//             )
//             VALUES (
//                 'U0000000', :companyID, 'Y', '26', 'A'
//             )
//         `, {
//             replacements: { companyID: nextCompanyID }
//         });

//         console.log("✅ Inserted into PLSDBM82");

//         /* ========= UPDATE CMPM00 ========= */
//         await sequelizeMASTER.query(`
//             UPDATE ${newDatabaseName}.dbo.CMPM00
//             SET FIELD01 = :companyID
//         `, {
//             replacements: { companyID: nextCompanyID }
//         });

//         console.log("✅ Updated CMPM00");

//         /* ========= CLEANUP FTP ========= */
//         try {
//             await ftpClient.remove(remoteFtpPath);
//             console.log("🧹 FTP file deleted");
//         } catch (err) {
//             console.log("⚠ FTP delete warning:", err.message);
//         }

//         /* ========= RESPONSE ========= */

//         response.status = 'SUCCESS';
//         response.message = "BAK restored and registered successfully";
//         response.data = {
//             database: newDatabaseName,
//             companyID: nextCompanyID,
//             companyName
//         };

//         encryptedResponse = encryptor.encrypt(JSON.stringify(response));
//         return res.status(200).json({ encryptedResponse });

//     } catch (err) {

//         console.error("❌ Restore Error:", err);

//         response.status = "FAIL";
//         response.message = err.message;

//         encryptedResponse = encryptor.encrypt(JSON.stringify(response));
//         return res.status(500).json({ encryptedResponse });

//     } finally {
//         console.log("🔚 Closing FTP");
//         ftpClient.close();
//     }
// };

// ____________________________________________________________________________________
// backup using zip file 


const restoreBak = async (req, res) => {

    let response = { status: "SUCCESS", message: "", data: null };
    let encryptedResponse;

    const ftpClient = new ftp.Client();

    let tempDir = null;
    let remoteFtpPath = null;

    try {

        console.log("🚀 ZIP Restore API HIT");

        /* ========= PAYLOAD ========= */
        // const p1 = JSON.parse(
        //     decodeURIComponent(encryptor.decrypt(req.body.pa))
        // );

        /* ========= TOKEN ========= */
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new Error("Authorization header missing");

        const token = authHeader.split(" ")[1];
        if (!token) throw new Error("Token missing");

        const decoded = await validateToken(token);

        if (!decoded || !decoded.corpId) {
            throw new Error("Invalid token or corpId missing");
        }

        const corporateID = decoded.corpId;
        console.log("👤 CorporateID:", corporateID);

        /* ========= GET SDB ========= */
        const parts = corporateID.split('-');

        let sdbName =
            parts.length === 3
                ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                : `${parts[0]}${parts[1]}SDB`;

        if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';

        const sequelizeSDB = db.getConnection(sdbName);

        /* ========= NEXT COMPANY ========= */
        const result = await sequelizeSDB.query(`
            SELECT ISNULL(MAX(CMPF01), 0) + 1 AS nextCompany
            FROM PLSDBCMP
        `, { type: QueryTypes.SELECT });

        const nextCompanyID = result[0].nextCompany;

        /* ========= FILE ========= */
        const file = req.files[0];

        if (!file) throw new Error("No file uploaded");

        if (path.extname(file.originalname) !== ".zip") {
            throw new Error("Only .zip file allowed");
        }

        /* ========= TEMP DIR ========= */
        tempDir = path.join("/tmp", "zip_" + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, file.originalname);

        await fs.promises.writeFile(zipPath, file.buffer);

        console.log("📦 ZIP saved:", zipPath);

        /* ========= UNZIP ========= */
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: tempDir }))
            .promise();

        console.log("📂 ZIP extracted");

        /* ========= FIND FILES ========= */
        const files = fs.readdirSync(tempDir);

        const bakFile = files.find(f => path.extname(f) === ".bak");
        const metaFile = files.find(f => f.endsWith(".json"));

        if (!bakFile) {
            throw new Error("No .bak file found inside ZIP");
        }

        const bakPath = path.join(tempDir, bakFile);

        console.log("📂 BAK Found:", bakFile);

        /* ========= OPTIONAL METADATA ========= */
        if (metaFile) {
            const metadata = JSON.parse(
                fs.readFileSync(path.join(tempDir, metaFile), "utf-8")
            );
            console.log("📄 Metadata:", metadata);
        }

        /* ========= FTP CONNECT ========= */
        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        console.log("✅ FTP Connected");

        /* ========= FTP UPLOAD ========= */
        const remoteFileName = `${Date.now()}_${bakFile}`;
        remoteFtpPath = `/html/eplus/${remoteFileName}`;
        const sqlPath = `/var/www/html/eplus/${remoteFileName}`;

        await ftpClient.uploadFrom(
            fs.createReadStream(bakPath),
            remoteFtpPath
        );

        console.log("⬆ Uploaded to FTP");

        /* ========= NEW DB NAME ========= */
        const newDatabaseName =
            `A${corporateID.slice(-5)}CMP${nextCompanyID.toString().padStart(4, "0")}`;

        /* ========= DROP ========= */
        await sequelizeMASTER.query(`
            IF DB_ID('${newDatabaseName}') IS NOT NULL
            BEGIN
                ALTER DATABASE [${newDatabaseName}]
                SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE [${newDatabaseName}];
            END
        `);

        /* ========= FILE LIST ========= */
        const fileList = await sequelizeMASTER.query(`
            RESTORE FILELISTONLY FROM DISK = '${sqlPath}'
        `);

        const dataFile = fileList[0].find(f => f.Type === 'D');
        const logFile = fileList[0].find(f => f.Type === 'L');

        /* ========= RESTORE ========= */
        await sequelizeMASTER.query(`
            RESTORE DATABASE [${newDatabaseName}]
            FROM DISK = '${sqlPath}'
            WITH 
                MOVE '${dataFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}.mdf',
                MOVE '${logFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}_log.ldf',
                REPLACE
        `);

        console.log("✅ DB Restored");

        /* ========= COMPANY NAME ========= */
        const [cmpData] = await sequelizeMASTER.query(`
            SELECT TOP 1 FIELD02 as companyName
            FROM ${newDatabaseName}.dbo.CMPM00
        `, { type: QueryTypes.SELECT });

        const companyName = cmpData?.companyName || `Company ${nextCompanyID}`;

        /* ========= INSERT PLSDBCMP ========= */
        await sequelizeSDB.query(`
            INSERT INTO PLSDBCMP (
                CMPF01, CMPF02, CMPF03, CMPF04,
                CMPF11, CMPF12, CMPF21, CMPF22, CMPF23, CMPF24
            )
            VALUES (
                :companyID, :companyName, 'SQL', 'No Group',
                'U0000000', GETDATE(),
                '94.176.235.105',
                'aipharma_aakash',
                'Aipharma@360',
                'DATA'
            )
        `, {
            replacements: { companyID: nextCompanyID, companyName }
        });

        /* ========= INSERT M82 ========= */
        await sequelizeSDB.query(`
            INSERT INTO PLSDBM82 (
                M82F01, M82F02, M82CMP, M82YRN, M82ADA
            )
            VALUES ('U0000000', :companyID, 'Y', '26', 'A')
        `, {
            replacements: { companyID: nextCompanyID }
        });

        /* ========= UPDATE CMPM00 ========= */
        await sequelizeMASTER.query(`
            UPDATE ${newDatabaseName}.dbo.CMPM00
            SET FIELD01 = :companyID
        `, {
            replacements: { companyID: nextCompanyID }
        });

        console.log("✅ Registration Done");

        /* ========= CLEANUP ========= */
        try {
            if (remoteFtpPath) await ftpClient.remove(remoteFtpPath);
        } catch { }

        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        response.status = "SUCCESS";
        response.message = "ZIP restored successfully";
        response.data = {
            database: newDatabaseName,
            companyID: nextCompanyID,
            companyName
        };

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        console.error("❌ Restore Error:", err);

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(500).json({ encryptedResponse });

    } finally {
        ftpClient.close();
    }
};
module.exports = { backupToDrive, restoreBak };