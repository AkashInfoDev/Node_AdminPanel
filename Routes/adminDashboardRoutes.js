const express = require('express');
const router = express.Router();
const dashboardController = require('../Controller/adminDashBoardController');

// In your express route:
router.get('/dashboardData',dashboardController.dashboardData);

module.exports = router;