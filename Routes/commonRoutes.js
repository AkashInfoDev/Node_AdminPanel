const express = require("express");
const router = express.Router();
const { handleActionGet } = require('../Controller/dbServerController');

router.get('/Server', handleActionGet);

module.exports = router;