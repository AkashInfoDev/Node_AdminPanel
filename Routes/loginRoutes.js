const express = require('express');
const router = express.Router();
const { AdminController, UserController } = require('../Controller/loginController');
const { RDBUserController } = require('../Controller/RDBUserController');
router.get('/UserInfo', UserController.manageUser);

// Other routes
router.get('/AdminInfo', AdminController.manageAdmin);
router.post('/GenerateOtp', UserController.sendOtpByCorp);
router.post('/VerifyOtp', UserController.verifyOtp);
router.post('/ResetPassword', UserController.resetPassword);
router.get('/UserType', RDBUserController.manageUser);

module.exports = router;
