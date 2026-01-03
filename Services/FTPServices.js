const ftp = require("basic-ftp");
const { Op } = require('sequelize');

const db = require('../Config/config'); // Your Database class
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const Encryptor = require('../Services/encryptor');

const sequelizeRDB = db.getConnection('RDB');

const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const encryptor = new Encryptor();

class FTPService {
    constructor(decoded, fname, cmpNM) {
        this.decoded = decoded;
        this.fileNM = fname;
        this.cmpNo = cmpNM;
    }

    // Download file method
    async downloadFile() {
        const client = new ftp.Client();
        client.ftp.verbose = true;  // Set to `false` to hide FTP commands for a cleaner log

        try {
            let FTPdetail = await PLRDBA01.findOne({
                where: {
                    A01F03: this.decoded.corpId
                }
            });
            // Connect to the FTP server
            await client.access({
                host: FTPdetail.FTPURL,     // FTP server hostname
                user: FTPdetail.FTPUID,       // FTP username
                password: FTPdetail.FTPPWD,   // FTP password
                secure: false,                   // Set to `true` if using FTPS
            });

            // List files in the FTP server's current directory
            console.log(await client.list());

            // Download a file from the FTP server
            await client.downloadTo(this.fileNM, `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images`);

            console.log("File downloaded successfully!");

        } catch (error) {
            console.error("Error accessing FTP server:", error);
        }
        client.close();
    }

    // Upload file method
    async uploadFile(localFilePath) {
        const client = new ftp.Client();
        client.ftp.verbose = true; // Set to `false` to hide FTP commands for a cleaner log

        try {
            let FTPdetail = await PLRDBA01.findOne({
                where: {
                    A01F03: this.decoded.corpId
                }
            });

            // Connect to the FTP server
            await client.access({
                host: FTPdetail.FTPURL,     // FTP server hostname
                user: FTPdetail.FTPUID,     // FTP username
                password: FTPdetail.FTPPWD, // FTP password
                secure: false,              // Set to `true` if using FTPS
            });

            // Upload a file to the FTP server
            await client.uploadFrom(localFilePath, `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`);

            console.log("File uploaded successfully!");

        } catch (error) {
            console.error("Error accessing FTP server:", error);
        }
        client.close();
    }
}

module.exports = FTPService;