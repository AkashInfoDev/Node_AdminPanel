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
const pLimit = require("p-limit");

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

async function executeSQLInBatches(dbConn, tableName, sqlScript) {

    const statements = sqlScript
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(Boolean);

    if (statements.length === 0) return;

    const BATCH_SIZE = 1000;

    console.log(`📦 Total: ${statements.length}`);

    // 🔥 Extract column structure from FIRST statement
    // const firstMatch = statements[0].match(/INSERT INTO\s+\S+\s*\((.*?)\)\s*VALUES\s*\((.*)\)/i);
    const firstMatch = statements[0].match(/INSERT INTO\s+\S+\s*\((.*?)\)\s*VALUES/i);

    if (!firstMatch) {
        throw new Error("Invalid INSERT format");
    }

    const columnList = firstMatch[1]; // col1,col2,...
    await ensureFLDBRCLength(dbConn, tableName);

    for (let i = 0; i < statements.length; i += BATCH_SIZE) {

        const transaction = await dbConn.transaction();

        try {

            const batchStatements = statements.slice(i, i + BATCH_SIZE);

            // 🔥 Extract only VALUES part
            // const valuesList = batchStatements.map(stmt => {
            //     // const match = stmt.match(/VALUES\s*\((.*)\)/i);
            //     const match = stmt.match(/VALUES\s*\(([\s\S]*?)\)$/i);
            //     if (!match) return null;
            //     return `(${match[1]})`;
            // }).filter(Boolean);
            const valuesList = batchStatements.map(stmt => {

                const valuesIndex = stmt.toUpperCase().indexOf("VALUES");
                if (valuesIndex === -1) return null;

                const valuesPart = stmt.substring(valuesIndex + 6).trim();
                const cleaned = valuesPart.replace(/;$/, '').trim();

                return cleaned.startsWith("(") ? cleaned : `(${cleaned})`;

            }).filter(Boolean); // ✅ IMPORTANT

            if (valuesList.length === 0) continue;

            const uniqueColumn = getUniqueColumn(tableName);

            let bulkQuery;

            if (uniqueColumn) {

                bulkQuery = `
                INSERT INTO [${tableName}] (${columnList})
                SELECT *
                FROM (VALUES ${valuesList.join(",\n")}) AS v(${columnList})
                WHERE NOT EXISTS (
                SELECT 1 
                FROM [${tableName}] t
                WHERE t.${uniqueColumn} = v.${uniqueColumn}
                );`;

            } else {

                // fallback normal insert
                bulkQuery = `
                INSERT INTO [${tableName}] (${columnList})
                VALUES ${valuesList.join(",\n")};
                `;
            }

            console.log(`🚀 Bulk Batch ${i / BATCH_SIZE + 1}`);

            try {
                await dbConn.query(bulkQuery, { transaction });
            } catch (err) {
                console.log("MAIN ERROR:", err.message);

                // 👇 THIS is what you are missing
                if (err.parent && err.parent.errors) {
                    err.parent.errors.forEach((e, i) => {
                        console.log(`ERROR ${i + 1}:`, e.message);
                    });
                } else {
                    console.log(err);
                }
            }
            await transaction.commit();

        } catch (err) {

            await transaction.rollback();

            console.error(`❌ Error in batch ${i / BATCH_SIZE + 1}:`, err.message);
            throw err;
        }
    }

    console.log(`✅ Done ${tableName}`);
}
function getUniqueColumn(tableName) {

    if (tableName.includes("M01") || tableName.includes("M21")) {
        return "FIELD02";
    }

    // Add more rules if needed
    return null; // no duplicate protection
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
function validateEmails(emailArray) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const invalidEmails = emailArray.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
        throw new Error(`Invalid email(s): ${invalidEmails.join(", ")}`);
    }
}

// const backupZipToDrive = async (req, res) => {

//     const sendResponse = (statusCode, status, message, data = null) => {
//         const response = { status, message, data };
//         const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
//         return res.status(statusCode).json({ encryptedResponse });
//     };

//     // let response = { data: null, message: '', status: 'Success' };
//     // let encryptedResponse;
//     const ftpClient = new ftp.Client();
//     ftpClient.ftp.verbose = false;

//     try {

//         /* ===============================
//            1️⃣ PAYLOAD VALIDATION
//         =============================== */

//         if (!req.body.pa) {
//             return sendResponse(400, "FAIL", "Missing payload");
//         }

//         const parameterString = encryptor.decrypt(req.body.pa);
//         const decodedParam = decodeURIComponent(parameterString);
//         const p1 = JSON.parse(decodedParam);

//         // const { companyID, yearNo, action } = p1;
//         // const { companyID, yearNo, action, emails } = p1;
//         const { companyID, yearNo, action, emails, smtp } = p1;

//         if (!companyID || !yearNo) {
//             return sendResponse(400, "FAIL", "companyID and yearNo required");
//         }


//         /* ===============================
//            2️⃣ TOKEN VALIDATION
//         =============================== */

//         const token = req.headers.authorization?.split(" ")[1];

//         if (!token) {
//             return sendResponse(401, "FAIL", "Authorization token missing");
//         }

//         const decoded = await validateToken(token);

//         if (!decoded || !decoded.corpId) {
//             return sendResponse(401, "FAIL", "Invalid token or corporateID missing");
//         }
//         const corporateID = decoded.corpId;

//         let refresh_token = null;

//         if (action === "G") {

//             console.log("🔍 Fetching Google token from DB...");

//             const corpData = await PLRDBA01.findOne({
//                 where: { A01F03: corporateID }
//             });

//             if (!corpData || !corpData.A01F18?.trim()) {
//                 throw new Error("Auth token not found for this corporate");
//             }

//             refresh_token = corpData.A01F18.trim();

//             console.log("✅ Token fetched (length):", refresh_token.length);
//         }
//         /* ===============================
//            3️⃣ GENERATE DATABASE NAME
//         =============================== */

//         const corporateLastFive = corporateID.slice(-5);
//         const formattedCompanyID = companyID.toString().padStart(4, "0");

//         const sourceDatabase = `A${corporateLastFive}CMP${formattedCompanyID}`;
//         const newDatabaseName = `CMP${formattedCompanyID}_${yearNo}`;

//         console.log("Source DB:", sourceDatabase);
//         console.log("Temp DB:", newDatabaseName);

//         /* ===============================
//            4️⃣ FETCH TABLE LIST
//         =============================== */

//         const tableData = await PLSYS14.findAll({
//             where: { S14F06: { [Op.in]: ['Y', 'F'] } },
//             attributes: ['S14F02']
//         });

//         if (!tableData || tableData.length === 0) {
//             return sendResponse(404, "FAIL", "No tables configured for backup");
//         }



//         const tempDir = path.join("/tmp", "downloads");
//         console.log("Temp Diractory", tempDir);


//         if (!fs.existsSync(tempDir)) {
//             fs.mkdirSync(tempDir, { recursive: true });
//         }

//         // const backupFilePath = path.join(tempDir, `${newDatabaseName}.bak`);

//         const backupFolder = path.join(tempDir, newDatabaseName);

//         if (!fs.existsSync(backupFolder)) {
//             fs.mkdirSync(backupFolder, { recursive: true });
//         }

//         /* ===============================
//         6️⃣ EXPORT TABLES TO SQL FILES
//         =============================== */

//         for (const row of tableData) {

//             const tablePrefix = row.S14F02.trim();
//             const tableName = `YR${yearNo}${tablePrefix}`;

//             console.log(`Processing ${tableName}`);

//             const check = await sequelizeMASTER.query(`
//                 SELECT 1
//                 FROM ${sourceDatabase}.INFORMATION_SCHEMA.TABLES
//                 WHERE TABLE_NAME = '${tableName}'
//                 `);

//             if (check[0].length === 0) {
//                 console.log(`Skipping missing table: ${tableName}`);
//                 continue;
//             }

//             await exportTableData(sourceDatabase, tableName, backupFolder);
//         }
//         await exportCMPF01Data(sourceDatabase, backupFolder, yearNo);


//         const zipFilePath = path.join(tempDir, `${newDatabaseName}.zip`);
//         await zipFolder(backupFolder, zipFilePath);

//         if (!fs.existsSync(zipFilePath)) {
//             throw new Error("Zip file creation failed");
//         }

//         /* ===============================
//            🔟 GOOGLE DRIVE AUTH
//         =============================== */



//         if (action === "G") {
//             if (!refresh_token) {
//                 throw new Error("Google Drive token missing");
//             }
//             oauth2Client.setCredentials({ refresh_token });
//         }

//         let comp = null;

//         if (action === "G") {
//             const root = await getOrCreateFolder("eplus");
//             const corp = await getOrCreateFolder(corporateID, root);
//             comp = await getOrCreateFolder(companyID.toString(), corp);
//         }

//         const zipFileName = path.basename(zipFilePath);
//         if (action === "G") {
//             /* ===============================
//                1️⃣1️⃣ DELETE OLD FILE FROM DRIVE
//             =============================== */

//             const existing = await drive.files.list({
//                 q: `name='${zipFileName}' and '${comp}' in parents and trashed=false`,
//                 fields: "files(id)"
//             });

//             for (const f of existing.data.files) {
//                 await drive.files.delete({ fileId: f.id });
//             }

//             /* ===============================
//                1️⃣2️⃣ UPLOAD TO DRIVE
//             =============================== */

//             const driveFile = await drive.files.create({
//                 requestBody: {
//                     name: zipFileName,
//                     parents: [comp]
//                 },
//                 media: {
//                     mimeType: "application/zip",
//                     body: fs.createReadStream(zipFilePath)
//                 },
//                 fields: "id"
//             });

//             /* ===============================
//                1️⃣3️⃣ CLEANUP LOCAL FILES
//             =============================== */

//             if (fs.existsSync(zipFilePath)) {
//                 fs.unlinkSync(zipFilePath);
//             }

//             if (fs.existsSync(backupFolder)) {
//                 fs.rmSync(backupFolder, { recursive: true, force: true });
//             }
//         } else if (action === "E") {

//             const fileName = path.basename(zipFilePath);

//             if (!emails) {
//                 throw new Error("Emails are required for mail action");
//             }

//             // ✅ Convert + validate
//             let emailArray = Array.isArray(emails)
//                 ? emails.map(e => e.trim())
//                 : emails.split(",").map(e => e.trim());

//             validateEmails(emailArray);

//             const emailList = emailArray.join(",");

//             console.log("📧 Sending backup to:", emailList);

//             // ✅ Send mail with SMTP support
//             await sendEmailWithAttachment(
//                 emailList,
//                 zipFilePath,
//                 fileName,
//                 smtp
//             );

//             /* CLEANUP */
//             if (fs.existsSync(zipFilePath)) {
//                 fs.unlinkSync(zipFilePath);
//             }

//             if (fs.existsSync(backupFolder)) {
//                 fs.rmSync(backupFolder, { recursive: true, force: true });
//             }

//             let response = {};

//             response.status = "SUCCESS";
//             response.message = "Backup sent to provided emails";

//             encryptedResponse = encryptor.encrypt(JSON.stringify(response));
//             return res.status(200).json({ encryptedResponse });
//         }
//         else if (action === "D") {

//             const fileName = path.basename(zipFilePath);

//             // ✅ IMPORTANT: expose filename to frontend
//             res.setHeader(
//                 "Content-Disposition",
//                 `attachment; filename="${fileName}"`
//             );

//             res.setHeader(
//                 "Access-Control-Expose-Headers",
//                 "Content-Disposition"
//             );

//             return res.download(zipFilePath, fileName, async (err) => {

//                 if (err) {
//                     console.error("Download error:", err);
//                 }

//                 /* ===============================
//                    CLEANUP AFTER DOWNLOAD
//                 =============================== */

//                 try {
//                     if (fs.existsSync(zipFilePath)) {
//                         fs.unlinkSync(zipFilePath);
//                     }

//                     if (fs.existsSync(backupFolder)) {
//                         fs.rmSync(backupFolder, { recursive: true, force: true });
//                     }

//                     console.log("🧹 Cleanup done after download");

//                 } catch (cleanupErr) {
//                     console.error("Cleanup error:", cleanupErr);
//                 }
//             });
//         }

//         /* ===============================
//            1️⃣4️⃣ SUCCESS RESPONSE
//         =============================== */

//         return sendResponse(
//             200,
//             "SUCCESS",
//             "Financial backup created successfully",
//             {
//                 corporateID,
//                 companyID,
//                 sourceDatabase,
//                 backupDatabase: newDatabaseName
//             }
//         );

//     } catch (err) {
//         console.error("backupToDrive error:", err);

//         return sendResponse(
//             500,
//             "FAIL",
//             "Internal server error"
//         );
//     }
//     //  finally {

//     //     ftpClient.close();

//     // }
// };

const backupZipToDrive = async (req, res) => {

    const sendResponse = (statusCode, status, message, data = null) => {
        const response = { status, message, data };
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(statusCode).json({ encryptedResponse });
    };

    try {
        /* ===============================
           1️⃣ PAYLOAD VALIDATION
        =============================== */
        if (!req.body.pa) {
            return sendResponse(400, "FAIL", "Missing payload");
        }

        const parameterString = encryptor.decrypt(req.body.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const { companyID, yearNo, action, emails, smtp } = JSON.parse(decodedParam);

        if (!companyID || !yearNo) {
            return sendResponse(400, "FAIL", "companyID and yearNo required");
        }

        /* ===============================
           2️⃣ TOKEN VALIDATION
        =============================== */
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return sendResponse(401, "FAIL", "Authorization token missing");
        }

        const decoded = await validateToken(token);
        if (!decoded?.corpId) {
            return sendResponse(401, "FAIL", "Invalid token");
        }

        const corporateID = decoded.corpId;

        /* ===============================
           3️⃣ GOOGLE TOKEN (IF NEEDED)
        =============================== */
        let refresh_token = null;

        if (action === "G") {
            const corpData = await PLRDBA01.findOne({
                where: { A01F03: corporateID }
            });

            if (!corpData?.A01F18?.trim()) {
                throw new Error("Google token missing");
            }

            refresh_token = corpData.A01F18.trim();
            oauth2Client.setCredentials({ refresh_token });
        }

        /* ===============================
           4️⃣ DATABASE NAMES
        =============================== */
        const corporateLastFive = corporateID.slice(-5);
        const formattedCompanyID = companyID.toString().padStart(4, "0");

        const sourceDatabase = corporateID.startsWith("A") ? `A${corporateLastFive}CMP${formattedCompanyID}` : `EP${corporateLastFive}CMP${formattedCompanyID}`;
        const newDatabaseName = `CMP${formattedCompanyID}_${yearNo}`;

        /* ===============================
           5️⃣ TABLE CONFIG
        =============================== */
        const tableData = await PLSYS14.findAll({
            where: { S14F06: { [Op.in]: ['Y', 'F'] } },
            attributes: ['S14F02']
        });

        if (!tableData?.length) {
            return sendResponse(404, "FAIL", "No tables configured");
        }

        /* ===============================
           6️⃣ FETCH EXISTING TABLES (ONCE)
        =============================== */
        const existingTablesRaw = await sequelizeMASTER.query(`
            USE ${sourceDatabase};
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES;
            `, {
                type: QueryTypes.SELECT
            });

        const tableSet = new Set(existingTablesRaw.map(t => t.TABLE_NAME));

        /* ===============================
           7️⃣ PATH SETUP
        =============================== */
        const tempDir = path.join("/tmp", "downloads");
        const backupFolder = path.join(tempDir, newDatabaseName);
        const zipFilePath = path.join(tempDir, `${newDatabaseName}.zip`);

        await fs.promises.mkdir(backupFolder, { recursive: true });

        /* ===============================
           8️⃣ PARALLEL EXPORT (LIMITED)
        =============================== */
        const limit = pLimit(5); // tune based on server

        await Promise.all(
            tableData.map(row =>
                limit(async () => {
                    const prefix = row.S14F02.trim();
                    const tableName = `YR${yearNo}${prefix}`;

                    if (!tableSet.has(tableName)) return;

                    return exportTableData(sourceDatabase, tableName, backupFolder);
                })
            )
        );

        await exportCMPF01Data(sourceDatabase, backupFolder, yearNo);

        /* ===============================
           9️⃣ ZIP CREATION
        =============================== */
        await zipFolder(backupFolder, zipFilePath);

        /* ===============================
           🔟 GOOGLE DRIVE
        =============================== */
        let comp = null;

        if (action === "G") {
            const root = await getOrCreateFolder("eplus");
            const corp = await getOrCreateFolder(corporateID, root);
            comp = await getOrCreateFolder(companyID.toString(), corp);

            const zipFileName = path.basename(zipFilePath);

            const existing = await drive.files.list({
                q: `name='${zipFileName}' and '${comp}' in parents and trashed=false`,
                fields: "files(id)"
            });

            // ✅ parallel delete
            await Promise.all(
                existing.data.files.map(f =>
                    drive.files.delete({ fileId: f.id })
                )
            );

            await drive.files.create({
                requestBody: {
                    name: zipFileName,
                    parents: [comp]
                },
                media: {
                    mimeType: "application/zip",
                    body: fs.createReadStream(zipFilePath)
                }
            });
        }

        /* ===============================
           1️⃣1️⃣ EMAIL
        =============================== */
        else if (action === "E") {

            if (!emails) throw new Error("Emails required");

            const emailArray = Array.isArray(emails)
                ? emails.map(e => e.trim())
                : emails.split(",").map(e => e.trim());

            validateEmails(emailArray);

            await sendEmailWithAttachment(
                emailArray.join(","),
                zipFilePath,
                path.basename(zipFilePath),
                smtp
            );
        }

        /* ===============================
           1️⃣2️⃣ DOWNLOAD
        =============================== */
        else if (action === "D") {

            const fileName = path.basename(zipFilePath);

            res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
            res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

            return res.download(zipFilePath, fileName, async () => {
                await cleanupFiles(zipFilePath, backupFolder);
            });
        }

        /* ===============================
           1️⃣3️⃣ CLEANUP
        =============================== */
        await cleanupFiles(zipFilePath, backupFolder);

        /* ===============================
           1️⃣4️⃣ RESPONSE
        =============================== */
        return sendResponse(
            200,
            "SUCCESS",
            "Backup created successfully",
            { corporateID, companyID, sourceDatabase, backupDatabase: newDatabaseName }
        );

    } catch (err) {
        console.error("backupZipToDrive error:", err);
        return sendResponse(500, "FAIL", "Internal server error");
    }
};

async function cleanupFiles(zipFilePath, backupFolder) {
    try {
        await Promise.all([
            fs.promises.rm(backupFolder, { recursive: true, force: true }),
            fs.promises.unlink(zipFilePath).catch(() => { })
        ]);
    } catch (err) {
        console.error("Cleanup error:", err);
    }
}

async function ensureFLDBRCLength(dbConn, tableName) {

    try {

        console.log(`🔍 Checking FLDBRC in ${tableName}`);

        // 1️⃣ Check column exists + size
        const [colCheck] = await dbConn.query(`
            SELECT CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
            AND COLUMN_NAME = 'FLDBRC'
        `);

        if (!colCheck.length) {
            console.log(`⚠️ FLDBRC not found in ${tableName}`);
            return;
        }

        const currentLength = colCheck[0].CHARACTER_MAXIMUM_LENGTH;

        // -1 means VARCHAR(MAX)
        if (currentLength === -1) {
            console.log(`✅ Already VARCHAR(MAX)`);
            return;
        }

        console.log(`⚠️ Current length: ${currentLength} → upgrading...`);

        // 2️⃣ Find DEFAULT constraint
        const [defaultConstraint] = await dbConn.query(`
            SELECT dc.name AS constraint_name
            FROM sys.default_constraints dc
            JOIN sys.columns c 
                ON dc.parent_object_id = c.object_id 
                AND dc.parent_column_id = c.column_id
            WHERE OBJECT_NAME(dc.parent_object_id) = '${tableName}'
            AND c.name = 'FLDBRC'
        `);

        // 3️⃣ Drop DEFAULT constraint if exists
        if (defaultConstraint.length) {

            const constraintName = defaultConstraint[0].constraint_name;

            console.log(`🧨 Dropping constraint: ${constraintName}`);

            await dbConn.query(`
                ALTER TABLE [${tableName}]
                DROP CONSTRAINT [${constraintName}]
            `);
        }

        // 4️⃣ Alter column
        await dbConn.query(`
            ALTER TABLE [${tableName}]
            ALTER COLUMN FLDBRC VARCHAR(MAX)
        `);

        console.log(`🚀 Column upgraded to VARCHAR(MAX)`);

    } catch (err) {

        console.error(`❌ Schema fix failed for ${tableName}:`, err.message);
        throw err;
    }
}

async function exportTableData(database, tableName, folderPath) {

    const filePath = path.join(folderPath, `${tableName}.sql`);

    const rows = await sequelizeMASTER.query(`
        SELECT * FROM ${database}.dbo.${tableName}
    `);

    if (!rows[0].length) {
        console.log(`No data in ${tableName}`);
        return;
    }

    /* =================================
       CHECK IDENTITY COLUMN
    ================================= */

    const identityCheck = await sequelizeMASTER.query(`
        SELECT name
        FROM ${database}.sys.identity_columns
        WHERE object_id = OBJECT_ID('${database}.dbo.${tableName}')
    `);

    const identityColumn = identityCheck[0]?.[0]?.name;

    /* =================================
       GET COLUMN NAMES (EXCLUDE IDENTITY)
    ================================= */

    const columns = Object.keys(rows[0][0])
        .filter(col => col !== identityColumn);

    const columnList = columns.join(",");

    let sqlContent = "";

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

        sqlContent += `INSERT INTO [${tableName}] (${columnList}) VALUES (${values.join(",")});\n`;
    }

    fs.writeFileSync(filePath, sqlContent);

    console.log(`✅ Created ${filePath}`);
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
    const sendResponse = (statusCode, status, message, data = null) => {
        const response = { status, message, data };
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(statusCode).json({ encryptedResponse });
    };
    const parameterString = encryptor.decrypt(req.body.pa);
    const decodedParam = decodeURIComponent(parameterString);
    const p1 = JSON.parse(decodedParam);

    // Token validation
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return sendResponse(401, "FAIL", "Authorization token missing");
    }

    const decoded = await validateToken(token);
    if (!decoded || !decoded.corpId) {
        return sendResponse(401, "FAIL", "Invalid token or corporateID missing");
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


    const tempDir = "/tmp";

    const zipPath = path.join(tempDir, file.originalname);
    const extractPath = path.join(tempDir, file.originalname.replace('.zip', ''));

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
            return sendResponse(400, "FAIL", "No CSV file found for financial year.");
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
            // const tableName = path.basename(sqlFile, '.sql').slice(-3); // last 3 chars as postfix
            const tableName = path.basename(sqlFile, '.sql');

            const filteredSQL = filterInsertStatements(sqlScript, tableName, datePostfixTables, uniquePostfixTables, financialYearStart, financialYearEnd);

            if (filteredSQL.trim()) {
                try {
                    // const dbConn = db.getConnection(targetDB);
                    // await dbConn.query(`USE ${targetDB}; ${filteredSQL}`, { type: QueryTypes.RAW });
                    const dbConn = db.getConnection(targetDB);

                    // 🔹 Extract table name properly
                    const tableName = path.basename(sqlFile, '.sql');

                    await executeSQLInBatches(dbConn, tableName, filteredSQL);
                    if (tableName.includes('M01')) {

                        await dbConn.query(
                            `WITH CTE AS (
            SELECT *,
            ROW_NUMBER() OVER (PARTITION BY FIELD02 ORDER BY FIELD02) AS rn
            FROM ${tableName}
        )
        DELETE FROM CTE
        WHERE rn > 1;`,
                            { type: QueryTypes.RAW }
                        );
                    } else if (tableName.includes('M21')) {

                        await dbConn.query(
                            `WITH CTE AS (
            SELECT *,
            ROW_NUMBER() OVER (PARTITION BY FIELD02 ORDER BY FIELD02) AS rn
            FROM ${tableName}
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
                    // return { status: 500, message: `Error executing SQL ${sqlFile}: ${err.message}` };
                    throw new Error(`Error executing SQL ${sqlFile}: ${err.message}`);
                }
            } else {
                console.log(`Skipping ${sqlFile}: no valid rows to insert`);
            }
        }

        // Cleanup
        fs.rmSync(extractPath, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
        return sendResponse(200, "SUCCESS", "Financial year restored successfully");

    } catch (error) {
        return sendResponse(500, "FAIL", "Error processing the ZIP file");
    }
}

/*** Filters INSERT statements based on table rules*/
function filterInsertStatements(sqlScript, tableName, dateTables, uniqueTables, startDate, endDate) {

    // 🔥 Remove IDENTITY_INSERT completely
    sqlScript = sqlScript
        .replace(/SET\s+IDENTITY_INSERT\s+\S+\s+ON;?/gi, '')
        .replace(/SET\s+IDENTITY_INSERT\s+\S+\s+OFF;?/gi, '');

    const insertStatements = sqlScript.split(/;\s*INSERT INTO/i)
        .map((stmt, i) => i === 0 ? stmt : 'INSERT INTO ' + stmt)
        .filter(stmt => stmt.trim() !== '');

    const filteredStatements = insertStatements.map(stmt => {

        /* ================= DATE BASED TABLES ================= */
        if (dateTables.includes(tableName)) {

            return stmt.replace(
                /INSERT INTO\s+\S+\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\);?/gi,
                (fullMatch, colNames, valuesBlock) => {

                    const columns = colNames.split(',').map(c => c.trim());

                    // 🔥 Only use FIELD02 (date)
                    const fieldDateIndex = columns.findIndex(c => c.toUpperCase() === 'FIELD02');

                    if (fieldDateIndex === -1) return ''; // skip if no date column

                    const rows = valuesBlock
                        .split(/\),\s*\(/)
                        .map(r => r.replace(/^[(]|[)]$/g, '').trim());

                    const filteredRows = rows.filter(row => {
                        if (!row) return false;

                        const rowValues = row.match(/'[^']*'|[^,]+/g)?.map(v => v.trim());
                        if (!rowValues || rowValues.length <= fieldDateIndex) return false;

                        const rawDate = rowValues[fieldDateIndex].replace(/'/g, '').trim();
                        const fieldDate = parseInt(rawDate);

                        if (isNaN(fieldDate)) return false;

                        return fieldDate >= startDate && fieldDate <= endDate;
                    });

                    if (filteredRows.length === 0) return '';

                    return `${fullMatch.match(/INSERT INTO\s+\S+/i)[0]} (${columns.join(',')}) VALUES (${filteredRows.join('),(')});`;
                }
            );
        }

        /* ================= UNIQUE TABLES ================= */
        else if (uniqueTables.includes(tableName)) {

            const seen = new Set();

            return stmt.replace(/\((.*?)\)/g, (match, values) => {

                const rows = values.split(/\),\s*\(/)
                    .map(v => v.replace(/^[(]|[)]$/g, ''));

                const filteredRows = rows.filter(row => {

                    const parts = row.split(',');
                    if (parts.length < 2) return false;

                    const field02 = parts[1]?.replace(/'/g, '').trim();

                    if (!field02) return false;

                    if (seen.has(field02)) return false;
                    seen.add(field02);

                    return true;
                });

                if (filteredRows.length === 0) return null;

                return '(' + filteredRows.join('),(') + ')';
            }).replace(/\(\)/g, '');
        }

        /* ================= NORMAL TABLE ================= */
        else {
            return stmt;
        }
    });

    return filteredStatements
        .filter(s => s && s.trim() !== '')
        .join(';\n');
}

module.exports = { backupZipToDrive, uploadBackupToFTP1, importBackupFromZip };