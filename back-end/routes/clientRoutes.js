const express = require('express');
const router = express.Router();
const {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  bulkUpload,
  csvUpload,
  getClientChats,
} = require('../controllers/clientController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @openapi
 * tags:
 *   - name: Clients
 *     description: Client (contact) management
 */

/**
 * @openapi
 * /api/clients:
 *   get:
 *     tags: [Clients]
 *     summary: Get all clients with search & pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: OK
 *   post:
 *     tags: [Clients]
 *     summary: Create a new client
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, mobile]
 *             properties:
 *               name: { type: string }
 *               mobile: { type: string }
 *               alternateMobile: { type: string }
 *               whatsappOptIn: { type: boolean }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.route('/').get(protect, getClients).post(protect, createClient);

/**
 * @openapi
 * /api/clients/bulk-upload:
 *   post:
 *     tags: [Clients]
 *     summary: Bulk import clients from CSV
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import result
 */
router.post('/bulk-upload', protect, csvUpload, bulkUpload);

/**
 * @openapi
 * /api/clients/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: Update client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     tags: [Clients]
 *     summary: Delete client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.route('/:id').put(protect, updateClient).delete(protect, deleteClient);

/**
 * @openapi
 * /api/clients/{id}/chats:
 *   get:
 *     tags: [Clients]
 *     summary: Get chat conversations for a client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/:id/chats', protect, getClientChats);

module.exports = router;
