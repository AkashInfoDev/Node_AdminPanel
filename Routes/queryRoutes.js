const express = require('express');
const router = express.Router();
const DatabaseController = require('../Controller/queryController');

// Route to get all records from a table in a specific database
router.get('/data', DatabaseController.getAllFromTable);

// Route to get records with conditions from a table in a specific database
router.post('/data/conditions', DatabaseController.getFromTableWithConditions);

module.exports = router;
