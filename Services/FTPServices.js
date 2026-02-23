const { Client } = require('ssh2');
const ftp = require("basic-ftp");
const stream = require('stream');  // To create a stream from the buffer
const path = require('path');
const fs = require('fs');

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

            // Download a file from the FTP server
            await client.downloadTo(this.fileNM, `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`);

        } catch (error) {
            console.error("Error accessing FTP server:", error);
        }
        client.close();
    }

    async uploadFile(req) {
        const ftpClient = new ftp.Client();
        ftpClient.ftp.verbose = true;  // Set to `false` for cleaner logs

        try {
            // Fetch FTP details based on corpId
            const FTPdetail = await this.getFTPDetails();
            if (!FTPdetail) {
                throw new Error('FTP details not found for the given corpId');
            }

            // Connect to the FTP server
            await ftpClient.access({
                host: FTPdetail.FTPURL,
                user: FTPdetail.FTPUID,
                password: FTPdetail.FTPPWD,
                secure: false, // Assuming FTP is non-secure; change to `true` if using FTPS
            });

            // Define the target file and directories on the server
            const FinalImage = `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`;
            const imageFolder = `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images/`;
            const cmpFolder = `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/`;
            const corpFolder = `/html/eplus/${this.decoded.corpId}/`;
            const remoteDir = path.dirname(FinalImage);  // Extract the directory part from the file path

            // Ensure the directory exists on the server
            await this.ensureDirectoriesExist(ftpClient, remoteDir);

            // Access the file buffer from the uploaded file (via req.files)
            const fileBuffer = req.files[0].buffer;

            // Create a readable stream from the file buffer
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            // Upload the file directly from the stream to the FTP server
            await ftpClient.uploadFrom(bufferStream, FinalImage);

            // After upload, set permissions using SSH
            await this.setPermissions(FinalImage, remoteDir, imageFolder, cmpFolder, corpFolder, ftpClient);

        } catch (error) {
            console.error("Error accessing FTP server:", error.message);
        } finally {
            // Ensure FTP client is closed after operation is complete or failed
            ftpClient.close();
        }
    }

    async getFTPDetails() {
        // Fetch FTP details based on corpId
        return await PLRDBA01.findOne({
            where: {
                A01F03: this.decoded.corpId,
            },
        });
    }

    // Function to ensure the directories exist on the server
    async ensureDirectoriesExist(ftpClient, remoteDir) {
        const directories = remoteDir.split('/').slice(1); // Remove leading '/'
        let currentDir = '';

        // Ensure each directory exists
        for (const dir of directories) {
            currentDir += `/${dir}`;
            try {
                await ftpClient.ensureDir(currentDir);
            } catch (error) {
                console.error(`Failed to create directory ${currentDir}:`, error.message);
            }
        }
    }

    async setPermissions(FinalImage, remoteDir, imageFolder, cmpFolder, corpFolder, ftpClient) {
        return new Promise((resolve, reject) => {
            try {
                // Set permissions for the directory and file
                const chmodCommands = [
                    `SITE chmod 775 ${corpFolder}`,
                    `SITE chmod 775 ${cmpFolder}`,
                    `SITE chmod 775 ${imageFolder}`,
                    `SITE chmod 775 ${FinalImage}`,
                ];

                // Execute chmod commands sequentially
                for (const command of chmodCommands) {
                    this.executeSSHCommand(command, ftpClient);
                    console.log(`Permissions set to 775 for ${command.split(' ')[2]}!`);
                }

                resolve();
            } catch (err) {
                console.error('Error setting permissions:', err);
                reject(err);
            }
        });
    }

    async executeSSHCommand(command, ftpClient) {


        const commandResult = await ftpClient.ftp.send(`${command}`);
        return true;
    }
}
module.exports = FTPService;