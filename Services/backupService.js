const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

class BackupService {
    constructor(options) {
        this.options = options;
        this.companies = [
            { companyNo: '001', companyName: 'Company A', languageCode: 'EN', sourcePath: '/path/to/companyA' },
            { companyNo: '002', companyName: 'Company B', languageCode: 'EN', sourcePath: '/path/to/companyB' }
        ];
        this.years = [
            { yearNo: '2023', yearInfo: '2023 Year Info', sourcePath: '/path/to/2023' }
        ];
    }

    // Helper method to send email
    async sendEmail(emailAddress, subject, body) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'your-email@gmail.com',
                pass: 'your-email-password'
            }
        });

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: emailAddress,
            subject: subject,
            text: body
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent: ' + info.response);
        } catch (error) {
            console.log('Error sending email:', error);
        }
    }

    // Method to handle backup process
    async backupData() {
        let selectedCompanies = [];
        let selectedYears = [];
        let nBackupMethod = 0; // 0 for HDD, 1 for HDD + Email

        // Handle Single or Multi-Company Backup
        if (this.options.nOption === 0) {
            // Single Company Backup
            selectedCompanies.push(this.companies.find(c => c.companyNo === this.options.companyNo));
        } else if (this.options.nOption === 1 || this.options.nOption === 2) {
            // Multi-Company Backup
            if (!this.options.selectedCompanies || this.options.selectedCompanies.length === 0) {
                throw new Error('Please select at least one company for backup.');
            }
            selectedCompanies = this.companies.filter(c => this.options.selectedCompanies.includes(c.companyNo));
        }

        // Prepare company backup information
        selectedCompanies.forEach(company => {
            let companyBackupInfo = {
                companyNo: company.companyNo,
                companyName: company.companyName,
                languageCode: company.languageCode,
                sourcePath: company.sourcePath + this.options.companyPref + company.companyNo.padStart(4, '0'),
                actionStatus: 0
            };
            console.log('Company backup info:', companyBackupInfo);
        });

        // Handle Year-based backup (if applicable)
        if (this.options.nOption === 2) {
            selectedYears.push(this.years.find(y => y.yearNo === this.options.yearNo));
        }

        selectedYears.forEach(year => {
            let yearBackupInfo = {
                yearNo: year.yearNo,
                yearInfo: year.yearInfo,
                sourcePath: "YR" + path.join(this.options.sourcePath, "YR" + year.yearNo)
            };
            console.log('Year backup info:', yearBackupInfo);
        });

        // Set backup destination path and method
        let destPath = this.options.destinationPath || './backups';
        let backupMethod = this.options.nBackupMethod || 0;

        // Check if email backup method is selected
        if (this.options.isEmailBackup) {
            nBackupMethod = 1;
            let emailAddress = this.options.emailAddress || 'support@example.com';
            await this.sendEmail(emailAddress, 'Backup Process', 'The backup process has started.');
        }

        // Start the backup process
        if (nBackupMethod === 0) {
            console.log('Backup to local drive...');
        } else {
            console.log('Backup to local drive and send email...');
        }

        // Simulate backup by copying files for each selected company
        selectedCompanies.forEach(company => {
            let companyBackupPath = path.join(destPath, company.companyNo);
            if (!fs.existsSync(companyBackupPath)) {
                fs.mkdirSync(companyBackupPath, { recursive: true });
            }

            // Simulate file backup process
            console.log(`Backing up ${company.companyName} from ${company.sourcePath} to ${companyBackupPath}`);
        });

        // Notify user that the backup is done
        console.log('Backup process completed.');
    }
}

module.exports = BackupService;