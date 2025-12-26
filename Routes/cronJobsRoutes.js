const express = require('express');
const router = express.Router();
const { AdminController, UserController } = require('../Controller/loginController');
const cronJob = require('../Services/cronJobServices');

// Now this handles /api/User/UserInfo
router.get('/deleteCmp', cronJob);

module.exports = router;
