const express = require('express');
const router = express.Router();
const { handlePLRDBEXP } = require('../Controller/expenseController');

// Define route for initiating backup
router.get('/expanseCharge', handlePLRDBEXP);

module.exports = router;