const express = require('express');
const router = express.Router();
const CompanyService = require('../Controller/companyController');

// Now this handles /api/User/UserInfo
router.get('/Create', CompanyService.createCompany);

module.exports = router;
