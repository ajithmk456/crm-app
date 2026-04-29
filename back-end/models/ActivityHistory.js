const mongoose = require('mongoose');

const activityHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['message', 'task', 'assignment', 'report', 'payment'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    referenceId: { type: String, required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    description: { type: String, default: '', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    adminOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityHistory', activityHistorySchema);
