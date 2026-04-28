const express = require('express');
const { sendChatMessage, getChatByPhone, getChatConversations } = require('../controllers/chatController');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Chat
 *     description: WhatsApp chat APIs powered by Gupshup
 */

/**
 * @openapi
 * /api/chat/send:
 *   post:
 *     tags:
 *       - Chat
 *     summary: Send WhatsApp message through Gupshup
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 example: "919999999999"
 *               message:
 *                 type: string
 *                 example: "Hello from CRM"
 *     responses:
 *       200:
 *         description: Message accepted by Gupshup
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Provider or server error
 */

// Sends outbound WhatsApp message through Gupshup.
router.post('/send', sendChatMessage);

/**
 * @openapi
 * /api/chat/conversations:
 *   get:
 *     tags:
 *       - Chat
 *     summary: Get chat conversation list
 *     responses:
 *       200:
 *         description: Conversation summaries
 */

// Fetches conversation list for chat sidebar.
router.get('/conversations', getChatConversations);

/**
 * @openapi
 * /api/chat/{phone}:
 *   get:
 *     tags:
 *       - Chat
 *     summary: Get chat history by phone number
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         example: "919999999999"
 *     responses:
 *       200:
 *         description: Sorted chat history
 *       400:
 *         description: Missing or invalid phone number
 */

// Fetches chat history for one phone number.
router.get('/:phone', getChatByPhone);

module.exports = router;
