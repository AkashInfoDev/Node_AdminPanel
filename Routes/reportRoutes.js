const express = require("express");
const router = express.Router();

const { uploadBackupToFTP, backupToDrive } = require("../Controller/backupMoveController");
const { uploadBackupToFTP1, backupZipToDrive } = require("../Controller/finYearController");


router.post("/uploadtoftp", uploadBackupToFTP);
router.post("/uploadtoftp1", uploadBackupToFTP1);

// router.post("/backup-to-drive", validateToken, backupToDrive);
router.post("/cmpBackUp", backupToDrive);
router.post("/finYearBk", backupZipToDrive);

module.exports = router;
