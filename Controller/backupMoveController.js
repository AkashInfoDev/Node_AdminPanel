// const { poolMASTER } = require("../db");
const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
// const { validateToken } = require("../middleware/authToken");
const { validateToken } = require('../Services/tokenServices');
// const { DT } = require("../DT");
const db = require("../Config/config");
const sequelizeMASTER = db.getConnection("MASTER");
const Encryptor = require("../Services/encryptor");
const encryptor = new Encryptor();

/* ================= GOOGLE OAUTH ================= */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const drive = google.drive({ version: "v3", auth: oauth2Client });


const createDatabaseBackup = async (databaseName) => {

    const checkDB = await sequelizeMASTER.query(
        `
        SELECT name 
        FROM sys.databases 
        WHERE name = :dbName
        `,
        {
            replacements: { dbName: databaseName },
            type: sequelizeMASTER.QueryTypes.SELECT
        }
    );

    if (!checkDB || checkDB.length === 0) {
        throw new Error(`Database ${databaseName} does not exist`);
    }

    // if (!fs.existsSync(backupFolder)) {
    //     fs.mkdirSync(backupFolder, { recursive: true });
    // }

    // const backupPath = path.join(backupFolder, `${databaseName}.bak`);
    const backupFolder = "/var/www/html/eplus/";
    const backupPath = `${backupFolder}${databaseName}.bak`;

    const query = `
        BACKUP DATABASE [${databaseName}]
        TO DISK = '${backupPath}'
        WITH FORMAT, INIT
    `;

    await sequelizeMASTER.query(query);

    return backupPath;
};
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



const backupToDrive = async (req, res) => {

    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;

    try {

        /* ===============================
           1️⃣ PAYLOAD VALIDATION
        =============================== */

        if (!req.body.pa) {
            return res.json({
                status: "FAIL",
                message: "Missing payload"
            });
        }

        const parameterString = encryptor.decrypt(req.body.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const p1 = JSON.parse(decodedParam);

        const { companyID, fileName, refresh_token } = p1;

        if (!companyID || !fileName || !refresh_token) {
            return res.json({
                status: "FAIL",
                message: "companyID, fileName and refresh_token required"
            });
        }

        /* ===============================
           2️⃣ TOKEN VALIDATION
        =============================== */

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.json({
                status: "FAIL",
                message: "Authorization token missing"
            });
        }

        const decoded = await validateToken(token);
        const corporateID = decoded.corpId;

        if (!corporateID) {
            return res.json({
                status: "FAIL",
                message: "Invalid token"
            });
        }

        /* ===============================
           3️⃣ GOOGLE AUTH
        =============================== */

        oauth2Client.setCredentials({
            refresh_token: refresh_token
        });

        /* ===============================
           4️⃣ LOCAL TEMP FILE
        =============================== */

        const tempDir = path.join(__dirname, "../downloads");
        fs.mkdirSync(tempDir, { recursive: true });

        const localPath = path.join(tempDir, fileName);

        /* ===============================
           5️⃣ FTP CONNECT
        =============================== */

        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        await ftpClient.cd("/html/eplus");

        const list = await ftpClient.list();

        if (!list.some(f => f.name === fileName)) {
            return res.json({
                status: "FAIL",
                message: "Backup not found on FTP"
            });
        }

        /* ===============================
           6️⃣ DOWNLOAD BACKUP
        =============================== */

        await ftpClient.downloadTo(localPath, fileName);

        /* ===============================
           7️⃣ GOOGLE DRIVE FOLDER
        =============================== */

        const root = await getOrCreateFolder("eplus");
        const corp = await getOrCreateFolder(corporateID, root);
        const comp = await getOrCreateFolder(companyID, corp);

        /* ===============================
           8️⃣ DELETE OLD BACKUP
        =============================== */

        const existing = await drive.files.list({
            q: `name='${fileName}' and '${comp}' in parents and trashed=false`,
            fields: "files(id)"
        });

        for (const f of existing.data.files) {
            await drive.files.delete({ fileId: f.id });
        }

        /* ===============================
           9️⃣ UPLOAD TO GOOGLE DRIVE
        =============================== */

        const driveFile = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [comp]
            },
            media: {
                body: fs.createReadStream(localPath)
            },
            fields: "id"
        });

        /* ===============================
           🔟 DELETE FTP FILE
        =============================== */

        await ftpClient.remove(fileName);

        /* ===============================
           1️⃣1️⃣ DELETE LOCAL FILE
        =============================== */

        fs.unlinkSync(localPath);

        return res.json({
            status: "SUCCESS",
            message: "Backup uploaded to Google Drive",
            data: {
                corporateID,
                companyID,
                driveFileId: driveFile.data.id,
                drivePath: `/eplus/${corporateID}/${companyID}/${fileName}`
            }
        });

    } catch (err) {

        console.error("backupToDrive error:", err);

        return res.status(500).json({
            status: "FAIL",
            message: err.message
        });

    } finally {
        ftpClient.close();
    }
};
const uploadBackupToFTP = async (req, res) => {

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


module.exports = { backupToDrive, uploadBackupToFTP };
