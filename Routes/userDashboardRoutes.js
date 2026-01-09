const express = require('express');
const router = express.Router();
const dashboardController = require('../Controller/userDashBoardController');
const AdminPanel = require('../Controller/adminPanelController');

// In your express route:
router.get('/dashboardData',dashboardController.dashboardData);
router.get('/adminData',AdminPanel.getUsers); // For Admin Panel of AI

module.exports = router;