const express = require('express');
const router = express.Router();

const loginRoutes = require('./loginRoutes');
const PriceList = require('./menuRoutes');
const Company = require('./companyRoutes');
const Branch = require('./branchRoutes');
const Roles = require('./roleRoutes');
const Module = require('./cusModuleRoutes')
const dbRoute = require('./userDashboardRoutes');
const Write = require('./fileRoutes');
const Plan = require('./PlanRoutes');
const Cron = require('./cronJobsRoutes');
const Token = require('./tokenRoutes');
const Google = require("./googleRoutes")
const reportRoutes = require("./reportRoutes");
const common = require("./commonRoutes");
const ticketRoutes = require("./ticketRoutes")

// Use loginRoutes under /User path
router.use('/User', loginRoutes);
router.use('/PriceList', PriceList);
router.use('/Company', Company);  // panding
router.use('/Branch', Branch);
router.use('/Role', Roles);
router.use('/Module', Module);
router.use('/userAdmindashboard', dbRoute);
router.use('/Write', Write);
router.use('/Plan', Plan);
router.use('/admindashboard', dbRoute);
// router.use('/cron', Cron);
router.use('/Token', Token);
router.use('/google', Google)
router.use('/report', reportRoutes)
router.use('/common', common)
router.use('/Ticket',ticketRoutes)

module.exports = router;
