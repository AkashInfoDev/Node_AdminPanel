const express = require('express');
const upgradePlan = require('../Controller/planController');

const router = express.Router();

// Define the route for handling the CRUD operations
router.get('/Handle', upgradePlan.handlePlan);

module.exports = router;
