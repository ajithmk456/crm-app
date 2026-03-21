const express = require('express');
const router = express.Router();
const { addPayment, getTaskPayments } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/roleMiddleware');

router.post('/', protect, authorizeRole('admin'), addPayment);
router.get('/:taskId', protect, getTaskPayments);

module.exports = router;
