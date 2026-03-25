const express = require("express");
const router = express.Router();
const multer = require("multer");

const { saveGoogleToken, backupToDrive, restoreBak, deleteFtpFile, checkGoogleToken } = require("../Controller/backupMoveController");
const { uploadBackupToFTP1, backupZipToDrive, importBackupFromZip } = require("../Controller/finYearController");

const upload = multer();
router.post("/uploadtoftp1", uploadBackupToFTP1);

// router.post("/backup-to-drive", validateToken, backupToDrive);
router.post("/cmpBackUp", backupToDrive);
router.post("/finYearBk", backupZipToDrive);
router.post("/finYearRs", upload.any(), importBackupFromZip);
router.post("/restoreBak", upload.any(), restoreBak);
router.post("/deleteFtpFile", deleteFtpFile);
router.post('/saveGoogleToken', saveGoogleToken);
router.get('/checkGoogleToken', checkGoogleToken);

module.exports = router;
