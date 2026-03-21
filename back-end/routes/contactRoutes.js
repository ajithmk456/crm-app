const express = require('express');
const { createContactEnquiry, deleteContactEnquiry } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/', createContactEnquiry);
router.delete('/:id', protect, authorizeRole('admin'), deleteContactEnquiry);

module.exports = router;
