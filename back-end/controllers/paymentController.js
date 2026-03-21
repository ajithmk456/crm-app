const Payment = require('../models/Payment');
const Task = require('../models/Task');
const Employee = require('../models/Employee');

const resolveAssignedIdsForUser = async (user) => {
  const ids = [String(user._id)];
  const role = (user.role || '').toLowerCase();

  if (role === 'admin') {
    return ids;
  }

  const email = (user.email || '').toLowerCase().trim();
  if (email) {
    const employee = await Employee.findOne({ email }).select('_id');
    if (employee?._id) {
      ids.push(String(employee._id));
    }
  }

  return [...new Set(ids)];
};

exports.addPayment = async (req, res, next) => {
  try {
    const { taskId, amount, paymentDate, paymentMode, notes } = req.body;

    if (!taskId || !amount || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: 'taskId, amount and paymentMode are required.',
      });
    }

    const task = await Task.findById(taskId).select('_id');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const payment = await Payment.create({
      taskId,
      amount,
      paymentDate: paymentDate || new Date(),
      paymentMode,
      notes: notes || '',
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

exports.getTaskPayments = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId).select('_id assignedTo totalAmount');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      const assignedIds = await resolveAssignedIdsForUser(req.user);
      const taskAssignedId = String(task.assignedTo || '');
      if (!assignedIds.includes(taskAssignedId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    const payments = await Payment.find({ taskId }).sort({ paymentDate: -1, createdAt: -1 });
    const amountReceived = payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalAmount = Number(task.totalAmount) || 0;
    const balanceAmount = Math.max(totalAmount - amountReceived, 0);

    res.status(200).json({
      success: true,
      data: payments,
      summary: {
        totalAmount,
        amountReceived,
        balanceAmount,
      },
      count: payments.length,
    });
  } catch (error) {
    next(error);
  }
};
