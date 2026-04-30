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
        const ftpClient = new ftp.Client();
        ftpClient.ftp.verbose = true;  // Set to `false` to hide FTP commands for a cleaner log

        try {
            let FTPdetail = await PLRDBA01.findOne({
                where: {
                    A01F03: this.decoded.corpId
                }
            });
            // Connect to the FTP server
            await ftpClient.access({
                host: FTPdetail.A01F52,
                user: FTPdetail.FTPUID,
                password: FTPdetail.FTPPWD,
                port: 21,  // Try 990 for implicit FTPS if 21 doesn't work
                secure: true,  // Use FTPS (Explicit FTPS)
                secureOptions: { rejectUnauthorized: false },  // Disable certificate validation (only for dev)
                passive: true,  // Passive mode (recommended for most cases)
                debug: (message) => console.log(message),  // Enable debug messages for more insight
            });

            // Download a file from the FTP server
            await ftpClient.downloadTo(this.fileNM, `${FTPdetail.FTPDIR}/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`);

        } catch (error) {
            console.error("Error accessing FTP server:", error);
        }
        ftpClient.close();
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
                host: FTPdetail.A01F52,
                user: FTPdetail.FTPUID,
                password: FTPdetail.FTPPWD,
                port: 21,  // Try 990 for implicit FTPS if 21 doesn't work
                secure: true,  // Use FTPS (Explicit FTPS)
                secureOptions: { rejectUnauthorized: false },  // Disable certificate validation (only for dev)
                passive: true,  // Passive mode (recommended for most cases)
                debug: (message) => console.log(message),  // Enable debug messages for more insight
            });

            // Define the target file and directories on the server
            const FinalImage = `${FTPdetail.FTPDIR}/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`;
            const imageFolder = `${FTPdetail.FTPDIR}/${this.decoded.corpId}/${this.cmpNo}/images/`;
            const cmpFolder = `${FTPdetail.FTPDIR}/${this.decoded.corpId}/${this.cmpNo}/`;
            const corpFolder = `${FTPdetail.FTPDIR}/${this.decoded.corpId}/`;
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
    const promises = [];

    for (const dir of directories) {
        currentDir += `/${dir}`;
        const dirPromise = await ftpClient.ensureDir(currentDir)
            .catch((error) => {
                console.error(`Failed to create directory ${currentDir}:`, error.message);
            });
        promises.push(dirPromise);
    }

    // Wait for all directory creation tasks to finish
    await Promise.all(promises);
}

async setPermissions(FinalImage, remoteDir, imageFolder, cmpFolder, corpFolder, ftpClient) {
    try {
        const chmodCommands = [
            `SITE chmod 775 ${corpFolder}`,
            `SITE chmod 775 ${cmpFolder}`,
            `SITE chmod 775 ${imageFolder}`,
            `SITE chmod 775 ${FinalImage}`,
        ];

        // Execute all chmod commands in parallel
        const permissionPromises = chmodCommands.map(command => this.executeSSHCommand(command, ftpClient));
        await Promise.all(permissionPromises);

        console.log(`Permissions set to 775 for all directories and file.`);
    } catch (err) {
        console.error('Error setting permissions:', err);
        throw err;  // Rethrow to handle it at the top level
    }
}

    async executeSSHCommand(command, ftpClient) {
        const commandResult = await ftpClient.ftp.send(`${command}`);
        return true;
    }
}
module.exports = FTPService;