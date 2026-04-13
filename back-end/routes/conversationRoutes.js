const express = require('express');
const { getConversations } = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getConversations);

module.exports = router;