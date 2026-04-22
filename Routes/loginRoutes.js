const express = require('express');
const router = express.Router();
const multer = require('multer');
const defineEP_FILE = require('../Models/RDB/EP_FILE');
const { DataTypes } = require('sequelize');
const db = require('../Config/config'); // Your Database class

const sequelizeRDB = db.getConnection('RDB');

const EP_FILE = defineEP_FILE(sequelizeRDB, DataTypes);

const { AdminController, UserController } = require('../Controller/loginController');
const { RDBUserController } = require('../Controller/RDBUserController');
const RolePageController = require('../Controller/RolePageController');
const upload = multer({
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB
    }
});

router.get('/UserInfo', UserController.manageUser);
router.post('/Register', upload.single('file'), (req, res) => {
    return UserController.registerUser({ req }, res);
});

// Other routes
router.get('/AdminInfo', AdminController.manageAdmin);
router.post('/GenerateOtp', UserController.sendOtpByCorp);
router.post('/VerifyOtp', UserController.verifyOtp);
router.post('/ResetPassword', UserController.resetPassword);
router.get('/UserType', RDBUserController.manageUser);
router.get('/RoleManage', RolePageController.managePages)

module.exports = router;
