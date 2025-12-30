const express = require('express');
const router = express.Router();
const CompanyService = require('../Controller/companyController');
const handleCompany = require('../Controller/handleCompany');

// Now this handles /api/User/UserInfo
router.get('/Create', CompanyService.createCompany);
router.get('/GetM00Ent', handleCompany.GetM00Ent);
router.post('/PostM00Ent', handleCompany.PostM00Ent);

module.exports = router;
