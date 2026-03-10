const express = require("express");
const router = express.Router();

// const { authenticateToken } = require("../middleware/authToken");
const { validateToken } = require('../Services/tokenServices');
const { uploadBackupToFTP, backupToDrive } = require("../Controller/backupMoveController");



router.post("/uploadtoftp", uploadBackupToFTP);
// router.post("/backup-to-drive", validateToken, backupToDrive);
router.post("/backup-to-drive", backupToDrive);



module.exports = router;
