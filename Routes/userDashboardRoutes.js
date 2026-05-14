const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
    limits: { fileSize: 2 * 1024 * 1024 }
});
const dashboardController = require('../Controller/userDashBoardController');
const AdminPanel = require('../Controller/adminPanelController');
const AdminDashboardController = require('../Controller/AdminDashboardController');
const AdminPlanController = require('../Controller/AdminPlanController');
const AdminModuleController = require('../Controller/AdminModuleController');
const CAdminPlanController = require('../Controller/CAdminPlanController');
const CAdminUserController = require('../Controller/CAdminUserController');
const WalletController = require('../Controller/WalletController');
const UserTypeController = require('../Controller/UserTypeController');

// In your express route:
// router.get('/adminData',AdminPanel.getUsers); // For Admin Panel of AI
router.get('/dashboardData', dashboardController.dashboardData);
router.get('/adminData', AdminDashboardController.dashboardCounts);
router.get('/getAllCorporateUsers', AdminDashboardController.getAllCorporateUsers);
router.get('/getUserList', AdminDashboardController.manageDashboard);
router.post('/getStatus', upload.single('file'), AdminDashboardController.updateCorporateStatus);
router.get('/getPlanDetails', AdminPlanController.managePlans);
router.get('/getModuleDetails', AdminModuleController.manageAddOns);
router.post('/Cadminplan', upload.single('file'), CAdminPlanController.handlePlan);
router.get('/CompanyAdminUser', CAdminUserController.manageUser);
router.get('/wallet', WalletController.handleWallet);
router.post('/withdraw', upload.single('file'), WalletController.requestWithdraw);
router.get('/UserRole', UserTypeController.manageUserType)
router.post('/deleteCorporateCompletely', AdminDashboardController.deleteCorporateCompletely);
router.get('/allUserTypes', UserTypeController.getTypes1)

module.exports = router;