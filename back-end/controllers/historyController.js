const ActivityHistory = require('../models/ActivityHistory');
const { resolveAdminScopeForRead } = require('../services/activityHistoryService');

exports.getHistory = async (req, res, next) => {
  try {
    const { clientId, taskId, fromDate, toDate, limit = '100' } = req.query;

    const query = {
      ...(await resolveAdminScopeForRead(req.user)),
    };

    if (clientId) {
      query.clientId = clientId;
    }

    if (taskId) {
      query.taskId = taskId;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate);
      }
    }

    const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));

    const items = await ActivityHistory.find(query)
      .populate('clientId', 'name mobile')
      .populate('taskId', 'title')
      .populate('employeeId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};
