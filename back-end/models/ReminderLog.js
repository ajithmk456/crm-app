const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    phone: { type: String, required: true },
    reminderType: { type: String, enum: ['scheduled', 'manual'], default: 'scheduled' },
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    messageId: { type: String },
    error: { type: String },
    sentAt: { type: Date },
    scheduledFor: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReminderLog', reminderLogSchema);
