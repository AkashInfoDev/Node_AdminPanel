const express = require('express');
const multer = require('multer');
const router = express.Router();
const CompanyService = require('../Controller/companyController');
const handleCompany = require('../Controller/handleCompany');

// Set up multer storage (if needed, otherwise it stores in memory by default)
const upload = multer();  // You can add configurations like file size limits if needed

// Now this handles /api/User/UserInfo
router.get('/Create', CompanyService.createCompany);
router.get('/GetM00Ent', handleCompany.GetM00Ent);

// Handling POST request for PostM00Ent with form-data (fields and file uploads)
router.post('/PostM00Ent', upload.any(), handleCompany.PostM00Ent);

module.exports = router;
