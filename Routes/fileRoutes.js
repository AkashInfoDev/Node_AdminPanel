// routes/fileRoutes.js
const express = require('express');
const { writeToFile } = require('../Controller/fileController');
const router = express.Router();

// Define the route for writing content to the file
router.post('/file', writeToFile);

module.exports = router;
