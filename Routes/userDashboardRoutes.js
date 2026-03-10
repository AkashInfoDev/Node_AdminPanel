const express = require('express');
const router = express.Router();
const dashboardController = require('../Controller/userDashBoardController');
const AdminPanel = require('../Controller/adminPanelController');
const AdminDashboardController = require('../Controller/AdminDashboardController');
const AdminPlanController = require('../Controller/AdminPlanController');
const AdminModuleController = require('../Controller/AdminModuleController');
const CAdminPlanController = require('../Controller/CAdminPlanController');
const CAdminUserController = require('../Controller/CAdminUserController');

// In your express route:
router.get('/dashboardData',dashboardController.dashboardData);
// router.get('/adminData',AdminPanel.getUsers); // For Admin Panel of AI
router.get('/adminData', AdminDashboardController.dashboardCounts);

router.get('/getAllCorporateUsers', AdminDashboardController.getAllCorporateUsers);
router.get('/getUserList', AdminDashboardController.manageDashboard);
router.get('/getPlanDetails', AdminPlanController.managePlans);
router.get('/getModuleDetails', AdminModuleController.manageAddOns);
router.get('/Cadminplan', CAdminPlanController.handlePlan);
router.get('/CompanyAdminUser', CAdminUserController.manageUser);

module.exports = router;