const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const TicketController = require('../Controller/TicketController')
const CategoryController = require('../Controller/CategoryController');
const TicketPermissionController = require('../Controller/TicketPermissionController');

router.post('/handleTicket', upload.array('files', 5), TicketController.handleTicket);
router.get('/handleCategory', CategoryController.manageCategory);
router.get('/TicketPermission',TicketPermissionController.managePermission);


module.exports = router;