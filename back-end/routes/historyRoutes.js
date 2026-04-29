const express = require('express');
const router = express.Router();
const { getHistory } = require('../controllers/historyController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @openapi
 * tags:
 *   - name: History
 *     description: Activity history timeline APIs
 */

/**
 * @openapi
 * /api/history:
 *   get:
 *     tags:
 *       - History
 *     summary: Get activity history timeline
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 100
 *     responses:
 *       200:
 *         description: Timeline items
 */
router.get('/', protect, getHistory);

module.exports = router;
