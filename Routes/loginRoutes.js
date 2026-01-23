const express = require('express');
const router = express.Router();
const { AdminController, UserController } = require('../Controller/loginController');

// Now this handles /api/User/UserInfo
router.get('/AdminInfo', AdminController.manageAdmin);
router.get('/UserInfo', UserController.manageUser);
router.post('/GenerateOtp', UserController.sendOtpByCorp);
router.post('/VerifyOtp', UserController.verifyOtp);
router.post('/ResetPassword', UserController.resetPassword);

module.exports = router;
