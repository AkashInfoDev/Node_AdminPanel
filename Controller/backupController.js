const BackupService = require('../services/backupService');

// Controller method to initiate backup
exports.initiateBackup = async (req, res) => {
    const options = req.body;

    try {
        const backupManager = new BackupService(options);
        await backupManager.backupData();
        res.status(200).json({ message: 'Backup process completed successfully.' });
    } catch (error) {
        console.error('Error during backup process:', error);
        res.status(500).json({ message: 'Error during backup process', error: error.message });
    }
};