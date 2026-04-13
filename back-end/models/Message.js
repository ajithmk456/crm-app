const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      default: 'text',
      trim: true,
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    replyTo: {
      type: String,
      trim: true,
      default: undefined,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);