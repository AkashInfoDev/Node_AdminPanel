const express = require('express');
const router = express.Router();
const BranchController = require('../Controller/branchController');

const branchController = new BranchController();

// In your express route:
router.get('/handleBranch', branchController.handleAction.bind(branchController));

module.exports = router;