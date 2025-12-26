const express = require('express');
const router = express.Router();
const reGenToken = require('../Controller/reGenToken');

// Now this handles /api/User/UserInfo
router.get('/token', reGenToken.tokenHandler);

module.exports = router;
