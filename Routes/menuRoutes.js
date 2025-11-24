const express = require('express');
const router = express.Router();
const menuController = require('../Controller/menuController');
const PricingPlanController = require('../Controller/priceListController');

// Route to get the menu tree
router.get('/menus', menuController.getMenuTree);
router.get('/pricing', PricingPlanController.handleAction);

module.exports = router;
