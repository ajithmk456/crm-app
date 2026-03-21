const cron = require('node-cron');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const ReminderLog = require('../models/ReminderLog');
const { sendWhatsAppMessage } = require('./whatsappService');

// Store active cron jobs for cleanup
const activeReminders = new Map();

/**
 * Calculate reminder time based on due date and reminder offset
 * @param {Date} dueDate - Task due date
 * @param {Number} reminderBefore - Minutes before due date
 * @returns {Date} Reminder time
 */
function calculateReminderTime(dueDate, reminderBefore) {
  if (!dueDate) return null;
  const reminderTime = new Date(dueDate);
  reminderTime.setMinutes(reminderTime.getMinutes() - reminderBefore);
  return reminderTime > new Date() ? reminderTime : null;
}

/**
 * Format cron expression from a Date object
 * @param {Date} date - Date to convert to cron
 * @returns {String} Cron expression (minute hour day month dayOfWeek)
 */
function getChronExpression(date) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${minute} ${hour} ${day} ${month} *`;
}

/**
 * Send reminder message to employee
 * @param {Object} task - Task object
 * @param {Object} employee - Employee object with phone
 * @returns {Promise<Object>} Reminder log result
 */
async function sendTaskReminder(task, employee) {
  try {
    const reminderLog = await ReminderLog.create({
      taskId: task._id,
      assignedTo: employee._id,
      phone: employee.phone,
      scheduledFor: task.reminderTime,
      status: 'pending',
    });

    // Format reminder message
    const dueDate = task.dueDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const message = `Reminder: Task "${task.title}" (${task.priority} priority) is due on ${dueDate}. Status: ${task.status}`;

    // Send WhatsApp message
    const result = await sendWhatsAppMessage(employee.phone, message);

    if (result.success) {
      reminderLog.status = 'success';
      reminderLog.messageId = result.messageId;
      reminderLog.sentAt = new Date();
    } else {
      reminderLog.status = 'failed';
      reminderLog.error = result.error || 'Unknown error';
    }

    await reminderLog.save();

    // Update task reminder sent flag
    await Task.updateOne({ _id: task._id }, { reminderSent: true });

    console.log(`[REMINDER] Task: ${task.title} | Employee: ${employee.fullName} | Status: ${reminderLog.status}`);
    return reminderLog;
  } catch (error) {
    console.error(`[REMINDER ERROR] Failed to send reminder for task ${task._id}:`, error.message);
    throw error;
  }
}

/**
 * Schedule a reminder for a specific task
 * @param {Object} task - Task object with dueDate and reminderBefore
 * @returns {Promise<void>}
 */
async function scheduleTaskReminder(task) {
  try {
    // Skip if reminder not enabled or already sent
    if (!task.reminderEnabled || task.reminderSent || !task.dueDate) {
      return;
    }

    // Calculate reminder time
    const reminderTime = calculateReminderTime(task.dueDate, task.reminderBefore);
    if (!reminderTime) {
      console.log(`[REMINDER] Task ${task._id}: reminder time is in the past, skipping`);
      return;
    }

    // Stop any existing job for this task
    if (activeReminders.has(task._id.toString())) {
      const existingJob = activeReminders.get(task._id.toString());
      existingJob.stop();
      activeReminders.delete(task._id.toString());
    }

    // Get assigned employee with phone
    const employeeId = task.assignedTo && typeof task.assignedTo === 'object' ? task.assignedTo._id : task.assignedTo;
    const employee = await Employee.findById(employeeId);
    if (!employee || !employee.phone) {
      console.warn(`[REMINDER] Task ${task._id}: Employee not found or no phone number`);
      return;
    }

    // Create cron expression
    const cronExpression = getChronExpression(reminderTime);

    // Schedule the reminder
    const job = cron.schedule(cronExpression, async () => {
      try {
        const freshTask = await Task.findById(task._id);
        if (freshTask && !freshTask.reminderSent) {
          await sendTaskReminder(freshTask, employee);
        }
        // Clean up after execution
        job.stop();
        activeReminders.delete(task._id.toString());
      } catch (error) {
        console.error(`[REMINDER] Execution error for task ${task._id}:`, error.message);
      }
    });

    // Store job reference
    activeReminders.set(task._id.toString(), job);

    // Update task with reminder time
    await Task.updateOne(
      { _id: task._id },
      { reminderTime, reminderScheduleId: task._id.toString() }
    );

    const formattedTime = reminderTime.toLocaleString('en-IN');
    console.log(`[REMINDER SCHEDULED] Task: ${task.title} | For: ${formattedTime} | Employee: ${employee.fullName}`);
  } catch (error) {
    console.error(`[REMINDER SCHEDULING ERROR] Task ${task._id}:`, error.message);
  }
}

/**
 * Reschedule a reminder (e.g., when due date or reminder settings change)
 * @param {Object} task - Updated task object
 * @returns {Promise<void>}
 */
async function rescheduleTaskReminder(task) {
  try {
    // Remove existing schedule
    if (activeReminders.has(task._id.toString())) {
      const existingJob = activeReminders.get(task._id.toString());
      existingJob.stop();
      activeReminders.delete(task._id.toString());
      console.log(`[REMINDER] Removed old schedule for task ${task._id}`);
    }

    // Reset reminder sent flag if due date changed
    if (task.dueDate && !task.reminderSent) {
      await Task.updateOne({ _id: task._id }, { reminderSent: false });
    }

    // Re-schedule if reminder is enabled
    if (task.reminderEnabled && task.dueDate && !task.reminderSent) {
      await scheduleTaskReminder(task);
    }
  } catch (error) {
    console.error(`[REMINDER RESCHEDULE ERROR] Task ${task._id}:`, error.message);
  }
}

/**
 * Initialize reminders for all active tasks on server startup
 * @returns {Promise<void>}
 */
async function initializeReminders() {
  try {
    const activeTasks = await Task.find({
      reminderEnabled: true,
      reminderSent: false,
      dueDate: { $gte: new Date() },
    }).populate('assignedTo');

    console.log(`[REMINDER INIT] Initializing ${activeTasks.length} task reminders...`);

    for (const task of activeTasks) {
      await scheduleTaskReminder(task);
    }

    console.log('[REMINDER INIT] Reminder initialization complete');
  } catch (error) {
    console.error('[REMINDER INIT ERROR]', error.message);
  }
}

/**
 * Send manual reminder for a specific task
 * @param {String} taskId - Task ID
 * @returns {Promise<Object>} Reminder log
 */
async function sendManualReminder(taskId) {
  try {
    const task = await Task.findById(taskId).populate('assignedTo');
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.assignedTo || !task.assignedTo.phone) {
      throw new Error('User or phone not found');
    }

    const reminderLog = await ReminderLog.create({
      taskId: task._id,
      assignedTo: task.assignedTo._id,
      phone: task.assignedTo.phone,
      reminderType: 'manual',
      scheduledFor: new Date(),
      status: 'pending',
    });

    const dueDate = task.dueDate?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) || 'Not set';

    const message = `⏰ Reminder: Task "${task.title}" (${task.priority} priority) due: ${dueDate}. Status: ${task.status}`;

    const result = await sendWhatsAppMessage(task.assignedTo.phone, message);

    if (result.success) {
      reminderLog.status = 'success';
      reminderLog.messageId = result.messageId;
      reminderLog.sentAt = new Date();
    } else {
      reminderLog.status = 'failed';
      reminderLog.error = result.error || 'Unknown error';
    }

    await reminderLog.save();
    console.log(`[MANUAL REMINDER] Task: ${task.title} | Status: ${reminderLog.status}`);
    return reminderLog;
  } catch (error) {
    console.error('[MANUAL REMINDER ERROR]', error.message);
    throw error;
  }
}

/**
 * Clean up all scheduled reminders (for shutdown)
 * @returns {void}
 */
function cleanupAllReminders() {
  activeReminders.forEach((job) => {
    job.stop();
  });
  activeReminders.clear();
  console.log('[REMINDER CLEANUP] All reminders stopped');
}

module.exports = {
  scheduleTaskReminder,
  rescheduleTaskReminder,
  initializeReminders,
  sendTaskReminder,
  sendManualReminder,
  cleanupAllReminders,
  calculateReminderTime,
  activeReminders,
};
