const express = require('express');
const { verifyWebhook, handleWebhook, handleGupshupWebhook } = require('../controllers/webhookController');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Webhooks
 *     description: Provider callback endpoints
 */

router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWebhook);
router.get('/gupshup', (req, res) => {
	res.status(200).json({ success: true, message: 'Gupshup webhook endpoint is reachable.' });
});

/**
 * @openapi
 * /webhook/gupshup:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Receive Gupshup WhatsApp webhook events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: message-event
 *               payload:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: 36bd54ac-6b6a-40fd-95f3-2c77b82df399
 *                   status:
 *                     type: string
 *                     enum: [sent, delivered, read, failed]
 *                   source:
 *                     type: string
 *                     example: "916384322139"
 *                   destination:
 *                     type: string
 *                     example: "919999999999"
 *                   text:
 *                     type: string
 *                     example: "Hi"
 *                   reason:
 *                     type: string
 *                     example: invalid number
 *     responses:
 *       200:
 *         description: Webhook acknowledged
 */
router.post('/gupshup', handleGupshupWebhook);

module.exports = router;