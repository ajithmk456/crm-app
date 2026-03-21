const express = require('express');
const router = express.Router();
const { sendBulkMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/roleMiddleware');

/**
 * @openapi
 * tags:
 *   - name: Messaging
 *     description: Bulk messaging endpoints
 */

/**
 * @openapi
 * /api/messages/bulk:
 *   post:
 *     tags:
 *       - Messaging
 *     summary: Send bulk message to group contacts (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - message
 *             properties:
 *               groupId:
 *                 type: string
 *                 example: 64f1b2c3d4e5f6a7b8c9d0e1
 *               message:
 *                 type: string
 *                 example: Hello team, please check updates.
 *               attachmentUrl:
 *                 type: string
 *                 example: https://example.com/image.jpg
 *     responses:
 *       200:
 *         description: Bulk message summary
 */
router.post('/bulk', protect, authorizeRole('admin'), sendBulkMessage);

module.exports = router;
