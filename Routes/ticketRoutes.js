const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const TicketController = require('../Controller/TicketController')


/* =========================
   🎯 TICKET ROUTE (CLASS BASED)
========================= */

// 🔥 EXACT SAME STYLE AS WALLET
router.post('/handleTicket', upload.array('files', 5), TicketController.handleTicket);

module.exports = router;