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



async function ensureDirectoriesExist(ftpClient, remoteDir) {
    const directories = remoteDir.split('/').slice(1); // remove first empty
    let currentDir = '';

    for (const dir of directories) {
        currentDir += `/${dir}`;
        try {
            await ftpClient.ensureDir(currentDir);
        } catch (err) {
            console.log(`Directory already exists: ${currentDir}`);
        }
    }
}


const backupToDrive = async (req, res) => {

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

        const { companyID, googledrive_token } = p1;

        if (!companyID || !googledrive_token) {
            response.status = "FAIL";
            response.message = "companyID and googledrive_token required";

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
        const corporateID = decoded.corpId;

        if (!corporateID) {
            response.status = "FAIL";
            response.message = "Invalid token";

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }

        /* ===============================
           3️⃣ DATABASE NAME GENERATION
        =============================== */

        const corporateLastFive = corporateID.slice(-5);
        const formattedCompanyID = companyID.toString().padStart(4, "0");

        const databaseName = `A${corporateLastFive}CMP${formattedCompanyID}`;
        const fileName = `${databaseName}.bak`;

        /* ===============================
           FTP & SERVER BACKUP PATH
        =============================== */

        const ftpFolderPath =
            `/html/eplus/${corporateID}`;

        const serverBackupPath =
            `/var/www/html/eplus/${corporateID}/${fileName}`;

        /* ===============================
           ENSURE SERVER DIRECTORY EXISTS
        =============================== */

        const backupDir = `/var/www/html/eplus/${corporateID}`;

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        /* ===============================
           GOOGLE AUTH
        =============================== */

        oauth2Client.setCredentials({
            refresh_token: googledrive_token
        });

        /* ===============================
           CONNECT FTP
        =============================== */

        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        /* ===============================
           ENSURE FTP DIRECTORY EXISTS
        =============================== */

        await ensureDirectoriesExist(ftpClient, ftpFolderPath);

        /* ===============================
           4️⃣ CREATE SQL BACKUP
        =============================== */

        console.log("Creating backup for DB:", databaseName);
        console.log("Backup path:", serverBackupPath);

        const query = `
        BACKUP DATABASE [${databaseName}]
        TO DISK = '${serverBackupPath}'
        WITH FORMAT, INIT, COMPRESSION, COPY_ONLY
        `;

        await sequelizeMASTER.query(query);

        /* ===============================
           LOCAL TEMP DIRECTORY
        =============================== */

        // const tempDir = path.join(__dirname, "../downloads");
        const tempDir = path.join("/tmp", "downloads");
        // fs.mkdirSync(tempDir, { recursive: true });
        await fs.promises.mkdir(tempDir, { recursive: true });

        const localPath = path.join(tempDir, fileName);

        /* ===============================
           NAVIGATE FTP DIRECTORY
        =============================== */

        await ftpClient.cd(ftpFolderPath);

        /* ===============================
           VERIFY BACKUP EXISTS
        =============================== */

        const files = await ftpClient.list();

        if (!files.some(f => f.name === fileName)) {
            throw new Error("Backup file not found on FTP");
        }

        /* ===============================
           DOWNLOAD BACKUP
        =============================== */

        await ftpClient.downloadTo(localPath, fileName);

        /* ===============================
           GOOGLE DRIVE FOLDERS
        =============================== */

        const root = await getOrCreateFolder("eplus");
        const corp = await getOrCreateFolder(corporateID, root);
        const comp = await getOrCreateFolder(companyID.toString(), corp);

        /* ===============================
           DELETE OLD DRIVE FILE
        =============================== */

        const existing = await drive.files.list({
            q: `name='${fileName}' and '${comp}' in parents and trashed=false`,
            fields: "files(id)"
        });

        for (const f of existing.data.files) {
            await drive.files.delete({ fileId: f.id });
        }

        /* ===============================
           UPLOAD TO GOOGLE DRIVE
        =============================== */

        const driveFile = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [comp]
            },
            media: {
                mimeType: "application/octet-stream",
                body: fs.createReadStream(localPath)
            },
            fields: "id"
        });

        /* ===============================
           DELETE FTP FILE AFTER UPLOAD
        =============================== */

        try {
            await ftpClient.remove(fileName);
        } catch (err) {
            console.log("FTP delete warning:", err.message);
        }

        /* ===============================
           DELETE LOCAL TEMP FILE
        =============================== */

        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        response.status = "SUCCESS";
        response.message = "Backup created and uploaded to Google Drive";

        response.data = {
            corporateID,
            companyID,
            databaseName,
            driveFileId: driveFile.data.id,
            drivePath: `/eplus/${corporateID}/${companyID}/${databaseName}/${fileName}`
        };

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));

        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        console.error("backupToDrive error:", err);

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));

        return res.status(500).json({ encryptedResponse });

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