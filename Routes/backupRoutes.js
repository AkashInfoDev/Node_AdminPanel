const express = require('express');
const router = express.Router();
const backupController = require('../Controller/backupController');

// Define route for initiating backup
router.post('/backup', backupController.initiateBackup);

module.exports = router;