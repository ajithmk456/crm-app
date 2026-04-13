const express = require('express');
const router = express.Router();
const {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/roleMiddleware');

router.post('/', protect, authorizeRole('admin'), createReport);
router.get('/', protect, authorizeRole('admin'), getReports);
router.get('/:id', protect, authorizeRole('admin'), getReportById);
router.put('/:id', protect, authorizeRole('admin'), updateReport);
router.delete('/:id', protect, authorizeRole('admin'), deleteReport);

module.exports = router;
