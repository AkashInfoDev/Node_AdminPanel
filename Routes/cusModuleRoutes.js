const express = require('express');
const CustomModules = require('../Controller/additionalPlanController');

const router = express.Router();

// Define the route for handling the CRUD operations
router.get('/CusMod', CustomModules.handlePLRDBPLREL);

module.exports = router;
