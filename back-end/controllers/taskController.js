const Task = require('../models/Task');
const Employee = require('../models/Employee');
const Enquiry = require('../models/Enquiry');
const { scheduleTaskReminder, rescheduleTaskReminder, sendManualReminder } = require('../services/reminderService');
const ReminderLog = require('../models/ReminderLog');

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

exports.createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      assignedTo,
      customerName,
      customerPhone,
      paymentReceived,
      priority,
      status,
      dueDate,
      reminderEnabled,
      reminderBefore,
    } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Title and assignedTo are required.' });
    }
    const task = await Task.create({
      title,
      description,
      assignedTo,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      paymentReceived: !!paymentReceived,
      priority: priority || 'Medium',
      status: status || 'Pending',
      dueDate,
      reminderEnabled: reminderEnabled ?? false,
      reminderBefore: reminderBefore || 15,
    });

    const populated = await Task.findById(task._id).populate('assignedTo', 'fullName email phone');
    
    if (task.reminderEnabled && task.dueDate) {
      await scheduleTaskReminder(task);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { search, status, priority, assignedTo, fromDate, toDate } = req.query;
    const query = {};

    if ((req.user.role || '').toLowerCase() !== 'admin') {
      const assignedIds = await resolveAssignedIdsForUser(req.user);
      query.assignedTo = { $in: assignedIds };
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (fromDate || toDate) {
      query.dueDate = {};
      if (fromDate) query.dueDate.$gte = new Date(fromDate);
      if (toDate) query.dueDate.$lte = new Date(toDate);
    }

    const tasks = await Task.find(query).populate('assignedTo', 'fullName email phone').sort({ dueDate: 1, createdAt: -1 });
    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
};

exports.getUpcomingReminders = async (req, res, next) => {
  try {
    const query = {
      reminderEnabled: true,
      reminderTime: { $ne: null },
      status: { $ne: 'Completed' },
    };

    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      const assignedIds = await resolveAssignedIdsForUser(req.user);
      query.assignedTo = { $in: assignedIds };
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email phone')
      .sort({ reminderTime: 1, dueDate: 1, createdAt: -1 });

    const now = new Date();
    const taskReminders = tasks.map((task) => {
      const assignedUser = task.assignedTo && typeof task.assignedTo === 'object'
        ? task.assignedTo.fullName || task.assignedTo.email || 'Unassigned'
        : String(task.assignedTo || 'Unassigned');

      const isOverdue = !task.reminderSent && task.reminderTime && new Date(task.reminderTime) < now;
      const reminderStatus = task.reminderSent ? 'sent' : isOverdue ? 'overdue' : 'upcoming';

      return {
        taskId: `task-${task._id}`,
        kind: 'task',
        taskName: task.title,
        assignedUser,
        reminderTime: task.reminderTime,
        dueDate: task.dueDate,
        taskStatus: task.status,
        priority: task.priority,
        reminderStatus,
        reminderSent: task.reminderSent,
        overdue: isOverdue,
      };
    });

    let enquiryReminders = [];
    if (isAdmin) {
      const enquiries = await Enquiry.find({ status: { $ne: 'Closed' } })
        .sort({ createdAt: -1 })
        .limit(20);

      enquiryReminders = enquiries.map((enquiry) => ({
        taskId: `enquiry-${enquiry._id}`,
        kind: 'enquiry',
        taskName: `New Enquiry: ${enquiry.name}`,
        assignedUser: enquiry.phone,
        reminderTime: enquiry.createdAt,
        dueDate: enquiry.createdAt,
        taskStatus: enquiry.status,
        priority: 'Medium',
        reminderStatus: 'upcoming',
        reminderSent: false,
        overdue: false,
      }));
    }

    const reminders = [...enquiryReminders, ...taskReminders].sort(
      (a, b) => new Date(b.reminderTime).getTime() - new Date(a.reminderTime).getTime()
    );

    res.status(200).json({ success: true, count: reminders.length, data: reminders });
  } catch (error) {
    next(error);
  }
};

exports.getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('assignedTo', 'fullName email phone');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if ((req.user.role || '').toLowerCase() !== 'admin') {
      const assignedIds = await resolveAssignedIdsForUser(req.user);
      const taskAssignedId = task.assignedTo?._id ? String(task.assignedTo._id) : String(task.assignedTo || '');
      if (!assignedIds.includes(taskAssignedId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: not assigned to this task' });
      }
    }
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

    if (!isAdmin) {
      const assignedIds = await resolveAssignedIdsForUser(req.user);
      const taskAssignedId = String(task.assignedTo || '');
      if (!assignedIds.includes(taskAssignedId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: not assigned to this task' });
      }
    }

    const {
      title,
      description,
      assignedTo,
      customerName,
      customerPhone,
      paymentReceived,
      priority,
      status,
      dueDate,
      reminderEnabled,
      reminderBefore,
    } = req.body;

    // Employees can only change their own task status.
    if (!isAdmin) {
      if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Valid status is required.' });
      }

      task.status = status;
      if (paymentReceived !== undefined) {
        task.paymentReceived = !!paymentReceived;
      }
      await task.save();
      const updated = await Task.findById(task._id).populate('assignedTo', 'fullName email phone');
      return res.status(200).json({ success: true, data: updated });
    }
    
    const dueDateChanged = dueDate && task.dueDate?.getTime() !== new Date(dueDate).getTime();
    const reminderChanged = reminderEnabled !== undefined || reminderBefore !== undefined;

    task.title = title ?? task.title;
    task.description = description ?? task.description;
    task.assignedTo = assignedTo ? assignedTo : task.assignedTo;
    task.customerName = customerName ?? task.customerName;
    task.customerPhone = customerPhone ?? task.customerPhone;
    if (paymentReceived !== undefined) task.paymentReceived = !!paymentReceived;
    task.priority = priority ?? task.priority;
    task.status = status ?? task.status;
    task.dueDate = dueDate ?? task.dueDate;
    if (reminderEnabled !== undefined) task.reminderEnabled = reminderEnabled;
    if (reminderBefore !== undefined) task.reminderBefore = reminderBefore;

    await task.save();
    const updated = await Task.findById(task._id).populate('assignedTo', 'fullName email phone');

    if ((dueDateChanged || reminderChanged) && task.reminderEnabled) {
      await rescheduleTaskReminder(updated);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.sendTaskReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reminderLog = await sendManualReminder(id);
    res.status(200).json({ success: true, data: reminderLog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTaskReminderLogs = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const logs = await ReminderLog.find({ taskId })
      .populate('assignedTo', 'fullName email phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    next(error);
  }
};
