const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    phone: { type: String, required: [true, 'Phone is required'], trim: true },
    message: { type: String, required: [true, 'Message is required'], trim: true },
    status: { type: String, enum: ['New', 'In Progress', 'Closed'], default: 'New' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
