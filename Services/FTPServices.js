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
    //     async uploadFile(localFilePath) {
    //     const client = new ftp.Client();
    //     client.ftp.verbose = true;  // Set to `false` for cleaner logs

    //     try {
    //         let FTPdetail = await PLRDBA01.findOne({
    //             where: {
    //                 A01F03: this.decoded.corpId
    //             }
    //         });

    //         // Connect to the FTP server
    //         await client.access({
    //             host: FTPdetail.FTPURL,
    //             user: FTPdetail.FTPUID,
    //             password: FTPdetail.FTPPWD,
    //             secure: false,
    //         });

    //         // Build the target path for the file
    //         const FinalImage = `/html/eplus/${this.decoded.corpId}/${this.cmpNo}/images/${this.fileNM}`;
    //         const remoteDir = path.dirname(FinalImage);  // Extract the directory from the file path

    //         // Ensure the directory exists or create it if missing
    //         await client.ensureDir(remoteDir);

    //         // Set the directory permission to 775
    //         await client.chmod(remoteDir, 0o775);  // This sets the permission to 775

    //         // Create a readable stream from the file buffer
    //         const bufferStream = new stream.PassThrough();
    //         bufferStream.end(localFilePath.buffer);  // Pipe the file buffer into the stream

    //         // Upload the file directly from the stream to the FTP server
    //         await client.uploadFrom(bufferStream, FinalImage);

    //         console.log("File uploaded successfully!");

    //     } catch (error) {
    //         console.error("Error accessing FTP server:", error);
    //     }

    //     client.close();
    // }

async uploadFile(req) {
        const ftpClient = new ftp.Client();
        ftpClient.ftp.verbose = true;  // Set to `false` for cleaner logs

        try {
            // Fetch FTP details based on corpId
            let FTPdetail = await this.getFTPDetails();
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
            const remoteDir = path.dirname(FinalImage);  // Extract the directory part from the file path

            // Ensure the directory exists on the server
            await ftpClient.ensureDir(remoteDir);

            // Access the file buffer from the uploaded file (via req.files)
            const fileBuffer = req.files[0].buffer;

            // Create a readable stream from the file buffer
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            // Upload the file directly from the stream to the FTP server
            await ftpClient.uploadFrom(bufferStream, FinalImage);

            console.log("File uploaded successfully!");

            // After upload, set permissions using SSH
            await this.setPermissions(FinalImage, remoteDir);

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

    async setPermissions(FinalImage, remoteDir) {
        const sshClient = new Client();
        const FTPdetail = await this.getFTPDetails();

        return new Promise((resolve, reject) => {
            sshClient.on('ready', async () => {
                try {
                    // Set permissions for the directory and file
                    const chmodDirCommand = `chmod 775 ${remoteDir}`;
                    const chmodFileCommand = `chmod 775 ${FinalImage}`;

                    // Execute chmod commands sequentially
                    await this.executeSSHCommand(sshClient, chmodDirCommand);
                    console.log("Permissions set to 775 for the directory!");

                    await this.executeSSHCommand(sshClient, chmodFileCommand);
                    console.log("Permissions set to 775 for the file!");

                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    sshClient.end();
                }
            }).connect({
                host: FTPdetail.FTPURL, // Using the same host as FTP URL (make sure SSH is enabled)
                username: FTPdetail.FTPUID, // Use the FTP user for SSH (if they are the same)
                password: FTPdetail.FTPPWD, // Use the FTP password for SSH (if they are the same)
                port: 22, // Default SSH port
            });
        });
    }

    // Function to execute SSH commands and return a promise
    executeSSHCommand(sshClient, command) {
        return new Promise((resolve, reject) => {
            sshClient.exec(command, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                stream.on('close', (code, signal) => {
                    resolve();
                });
                stream.on('data', (data) => {
                    console.log(data.toString());
                });
                stream.on('stderr', (data) => {
                    console.error(data.toString());
                });
            });
        });
    }
}
module.exports = FTPService;