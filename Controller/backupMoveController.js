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
const definePLSTATE = require('../Models/IDB/PLSTATE');
const sequelizeIDB = db.getConnection('IDBAPI');

const encryptor = new Encryptor();


const PLSTATE = definePLSTATE(sequelizeIDB);
/* ================= GOOGLE OAUTH ================= */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const drive = google.drive({ version: "v3", auth: oauth2Client });

async function getStates() {
    console.log("🌍 Fetching states from PLSTATE...");

    const states = await PLSTATE.findAll({
        raw: true
    });

    console.log("✅ Total states fetched:", states.length);

    return states.map(s => ({
        stateCode: s.PLSF01,
        stateName: s.PLSF02
    }));
}
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
        SELECT BRCODE, BRNAME, BRGST, BRCCOMP,BRSTATE
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
        BRGST: b.BRGST,
        BRSTATE: b.BRSTATE
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
        const localDir = path.join("..", "..", "..", '/tmp', "downloads", fileName);
        await fs.promises.mkdir(localDir, { recursive: true });

        const bakPath = path.join(localDir, fileName);

        console.log("⬇ Downloading BAK to:", bakPath);
        await ftpClient.downloadTo(bakPath, `${ftpFolderPath}${fileName}`);
        console.log("✅ BAK Downloaded");

        /* ========= JSON ========= */
        console.log("🧾 Creating JSON...");
        const branches = await getCompanyBranches(corporateID, companyID);
        const states = await getStates();

        /* 🔥 STATE LOOKUP */
        const stateMap = {};
        states.forEach(s => {
            stateMap[s.stateCode] = s.stateName;
        });

        const enrichedBranches = branches.map(b => ({
            ...b,
            BRGST: b.BRGST === "null" ? null : b.BRGST,
            STATENAME: b.BRSTATE ? stateMap[b.BRSTATE] || "" : ""
        }));

        const jsonPath = path.join(localDir, `${databaseName}.json`);

        await fs.promises.writeFile(
            jsonPath,
            JSON.stringify(
                { corporateID, companyID, branches: enrichedBranches, states },
                null,
                2
            )
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

        /* ========= DELETE OLD ZIP ========= */
        console.log("🗑 Checking existing ZIP on Drive...");

        const existingFiles = await drive.files.list({
            q: `name='${databaseName}.zip' and '${comp}' in parents and trashed=false`,
            fields: "files(id, name)"
        });

        for (const file of existingFiles.data.files) {
            await drive.files.delete({ fileId: file.id });
            console.log(`🗑 Deleted old ZIP: ${file.id}`);
        }

        /* ========= UPLOAD ========= */
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

        /* ========= CLEANUP ========= */
        console.log("🧹 Cleaning up...");

        /* 🔥 FTP DELETE WITH RETRY */
        const deleteFromFTP = async (retries = 3) => {
            for (let i = 1; i <= retries; i++) {
                try {
                    console.log(`🗑 Attempt ${i} to delete BAK from FTP...`);

                    // wait to avoid SQL lock
                    await new Promise(r => setTimeout(r, 2000));

                    const list = await ftpClient.list(ftpFolderPath);
                    const exists = list.some(f => f.name === fileName);

                    if (!exists) {
                        console.log("⚠ File already removed from FTP");
                        return;
                    }

                    await ftpClient.remove(`${ftpFolderPath}${fileName}`);
                    console.log("✅ FTP BAK deleted successfully");
                    return;

                } catch (err) {
                    console.error(`❌ Delete attempt ${i} failed:`, err.message);

                    if (i === retries) {
                        console.error("🚨 FINAL: Unable to delete BAK from FTP");
                    }
                }
            }
        };

        await deleteFromFTP();

        /* LOCAL CLEANUP */
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

const restoreBak = async (req, res) => {

    let response = { status: "SUCCESS", message: "", data: null };
    let encryptedResponse;

    const ftpClient = new ftp.Client();

    let tempDir = null;
    let remoteFtpPath = null;
    let remoteFileName = null;

    const transaction = await sequelizeMASTER.transaction();

    try {

        console.log("🚀 ZIP Restore API HIT");

        /* ========= PAYLOAD ========= */
        if (!req.body.pa) throw new Error("Payload missing");

        let branchMappings = [];
        let skipBranchUpdate = false;

        try {
            if (req.body.pa === "false") {
                skipBranchUpdate = true;
            } else {
                const decrypted = encryptor.decrypt(req.body.pa);

                if (decrypted === "false") {
                    skipBranchUpdate = true;
                } else {
                    const p1 = JSON.parse(decodeURIComponent(decrypted));
                    branchMappings = p1.BRCODE || [];
                }
            }
        } catch {
            throw new Error("Invalid payload format");
        }

        /* ========= TOKEN ========= */
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) throw new Error("Token missing");

        const decoded = await validateToken(token);
        if (!decoded?.corpId) throw new Error("Invalid token");

        const corporateID = decoded.corpId;

        /* ========= SDB ========= */
        const parts = corporateID.split('-');
        let sdbName = parts.length === 3
            ? `${parts[0]}${parts[1]}${parts[2]}SDB`
            : `${parts[0]}${parts[1]}SDB`;

        if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';

        const sequelizeSDB = db.getConnection(sdbName);

        /* ========= NEXT COMPANY ========= */
        // const result = await sequelizeSDB.query(`
        //     SELECT ISNULL(MAX(CMPF01), 0) + 1 AS nextCompany
        //     FROM PLSDBCMP
        // `, { type: QueryTypes.SELECT });

        // const nextCompanyID = result[0].nextCompany;

        const companies = await sequelizeSDB.query(`
    SELECT CMPF01 FROM PLSDBCMP
`, { type: QueryTypes.SELECT });

        const usedIds = companies
            .map(c => Number(c.CMPF01))
            .filter(n => !isNaN(n) && n > 0);

        let nextCompanyID = 1;

        while (true) {

            // 🔹 Check if ID used in table
            const existsInTable = usedIds.includes(nextCompanyID);

            // 🔹 Check if DB already exists
            const dbName = `A${corporateID.slice(-5)}CMP${nextCompanyID.toString().padStart(4, "0")}`;

            const dbCheck = await sequelizeMASTER.query(`
        SELECT DB_ID(:dbName) as dbid
    `, {
                replacements: { dbName },
                type: QueryTypes.SELECT
            });

            const existsInDB = dbCheck[0].dbid !== null;

            // ✅ If both free → use it
            if (!existsInTable && !existsInDB) {
                break;
            }

            nextCompanyID++;
        }

        console.log("🆕 Final Safe CompanyID:", nextCompanyID);

        /* ========= FILE ========= */
        const file = req.files?.[0];
        if (!file) throw new Error("No file uploaded");

        if (path.extname(file.originalname) !== ".zip") {
            throw new Error("Only ZIP file allowed");
        }

        /* ========= TEMP ========= */
        tempDir = path.join("/tmp", "zip_" + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, file.originalname);
        await fs.promises.writeFile(zipPath, file.buffer);

        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: tempDir }))
            .promise();

        const files = fs.readdirSync(tempDir);
        const bakFile = files.find(f => path.extname(f) === ".bak");
        if (!bakFile) throw new Error("No .bak file found");

        const bakPath = path.join(tempDir, bakFile);

        /* ========= FTP ========= */
        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        remoteFileName = `${Date.now()}_${bakFile}`;
        remoteFtpPath = `/html/eplus/${remoteFileName}`;
        const sqlPath = `/var/www/html/eplus/${remoteFileName}`;

        await ftpClient.uploadFrom(fs.createReadStream(bakPath), remoteFtpPath);

        /* ========= DB NAME ========= */
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
        `, { transaction });

        /* ========= RESTORE ========= */
        const fileList = await sequelizeMASTER.query(`
            RESTORE FILELISTONLY FROM DISK = '${sqlPath}'
        `);

        const dataFile = fileList[0].find(f => f.Type === 'D');
        const logFile = fileList[0].find(f => f.Type === 'L');

        await sequelizeMASTER.query(`
            RESTORE DATABASE [${newDatabaseName}]
            FROM DISK = '${sqlPath}'
            WITH 
                MOVE '${dataFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}.mdf',
                MOVE '${logFile.LogicalName}' TO '/var/opt/mssql/data/${newDatabaseName}_log.ldf',
                REPLACE
        `);

        // .mdf → data
        //   .ldf → logs
        /* ========= COMPANY ========= */
        const [cmpData] = await sequelizeMASTER.query(`
            SELECT TOP 1 FIELD02 as companyName
            FROM ${newDatabaseName}.dbo.CMPM00
        `, { type: QueryTypes.SELECT });

        const companyName = cmpData?.companyName || `Company ${nextCompanyID}`;

        /* ========= REGISTER ========= */
        await sequelizeSDB.query(`
            INSERT INTO PLSDBCMP (CMPF01, CMPF02, CMPF03, CMPF04,
            CMPF11, CMPF12, CMPF21, CMPF22, CMPF23, CMPF24)
            VALUES (:companyID, :companyName, 'SQL', 'No Group',
            'U0000000', GETDATE(),
            '94.176.235.105','aipharma_aakash','Aipharma@360','DATA')
        `, { replacements: { companyID: nextCompanyID, companyName } });

        await sequelizeSDB.query(`
            INSERT INTO PLSDBM82 (M82F01, M82F02, M82CMP, M82YRN, M82ADA)
            VALUES ('U0000000', :companyID, 'N', '26', 'A')
        `, { replacements: { companyID: nextCompanyID } });

        await sequelizeMASTER.query(`
            UPDATE ${newDatabaseName}.dbo.CMPM00
            SET FIELD01 = :companyID
        `, {
            replacements: { companyID: nextCompanyID },
            transaction
        });

        console.log("✅ Registration Completed");

        /* ========= 🔥 UPDATE BRCCOMP FROM PA ========= */
        if (branchMappings.length > 0) {

            for (const branch of branchMappings) {

                if (!branch.BRCODENEW) continue;

                const existing = await sequelizeSDB.query(`
                    SELECT BRCCOMP 
                    FROM PLSDBBRC
                    WHERE BRCODE = :brcode
                `, {
                    replacements: { brcode: branch.BRCODENEW },
                    type: QueryTypes.SELECT
                });

                if (existing.length === 0) {
                    console.log(`⚠ Not found: ${branch.BRCODENEW}`);
                    continue;
                }

                let compList = (existing[0].BRCCOMP || "")
                    .split(',')
                    .map(c => c.trim())
                    .filter(Boolean);

                if (!compList.includes(String(nextCompanyID))) {
                    compList.push(String(nextCompanyID));
                }

                await sequelizeSDB.query(`
                    UPDATE PLSDBBRC
                    SET BRCCOMP = :comp
                    WHERE BRCODE = :brcode
                `, {
                    replacements: {
                        comp: compList.join(','),
                        brcode: branch.BRCODENEW
                    }
                });

                console.log(`✅ ${branch.BRCODENEW} → ${compList.join(',')}`);
            }
        }

        /* ========= 🔥 FLDBRC REPLACE ========= */
        if (!skipBranchUpdate && branchMappings.length > 0) {

            const tables = await sequelizeMASTER.query(`
                SELECT DISTINCT TABLE_NAME
                FROM ${newDatabaseName}.INFORMATION_SCHEMA.COLUMNS
                WHERE COLUMN_NAME = 'FLDBRC'
            `, { type: QueryTypes.SELECT });

            for (const branch of branchMappings) {

                for (const t of tables) {

                    try {
                        await sequelizeMASTER.query(`
                            UPDATE ${newDatabaseName}.dbo.[${t.TABLE_NAME}]
                            SET FLDBRC = REPLACE(FLDBRC, :oldCode, :newCode)
                            WHERE FLDBRC LIKE '%' + :oldCode + '%'
                        `, {
                            replacements: {
                                oldCode: branch.BRCODEOLD,
                                newCode: branch.BRCODENEW
                            },
                            transaction
                        });

                    } catch (err) {
                        console.log(`❌ ${t.TABLE_NAME}: ${err.message}`);
                    }
                }
            }
        }

        await transaction.commit();

        /* ========= FTP DELETE ========= */
        for (let i = 0; i < 3; i++) {
            try {
                const list = await ftpClient.list("/html/eplus");
                if (list.find(f => f.name === remoteFileName)) {
                    await ftpClient.remove(remoteFtpPath);
                }
                break;
            } catch {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
        
        response.status = 'SUCCESS';
        response.message = "ZIP restored successfully";
        response.data = { database: newDatabaseName };

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        await transaction.rollback();

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(500).json({ encryptedResponse });

    } finally {
        ftpClient.close();
    }
};

const deleteFtpFile = async (req, res) => {

    let response = { status: "SUCCESS", message: "", data: null };
    let encryptedResponse;

    const ftpClient = new ftp.Client();
    ftpClient.ftp.verbose = false;

    try {

        console.log("🗑 FTP Delete API HIT");

        /* ========= TOKEN ========= */
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) throw new Error("Token missing");

        const decoded = await validateToken(token);
        if (!decoded?.corpId) throw new Error("Invalid token");

        /* ========= PAYLOAD ========= */
        if (!req.body.fileName) {
            throw new Error("fileName is required");
        }

        const fileName = req.body.fileName;

        // 🔥 Security check (prevent path injection)
        if (fileName.includes("/") || fileName.includes("..")) {
            throw new Error("Invalid file name");
        }

        const remotePath = `/html/eplus/${fileName}`;

        /* ========= FTP CONNECT ========= */
        await ftpClient.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });

        console.log("✅ FTP Connected");

        /* ========= CHECK FILE EXISTS ========= */
        const list = await ftpClient.list("/html/eplus");

        const exists = list.find(f => f.name === fileName);

        if (!exists) {
            throw new Error("File not found on FTP");
        }

        /* ========= DELETE ========= */
        await ftpClient.remove(remotePath);

        console.log("✅ File deleted:", remotePath);

        response.message = "File deleted successfully";
        response.data = { fileName };

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });

    } catch (err) {

        console.error("❌ FTP Delete Error:", err.message);

        response.status = "FAIL";
        response.message = err.message;

        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(500).json({ encryptedResponse });

    } finally {
        ftpClient.close();
    }
};
module.exports = { backupToDrive, restoreBak, deleteFtpFile };