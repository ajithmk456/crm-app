const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full Name is required'] },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Please provide a valid email'],
    },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    role: { type: String, enum: ['Admin', 'Employee'], default: 'Employee' },
    status: { type: Boolean, default: true },
    adminOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
