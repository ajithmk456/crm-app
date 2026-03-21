const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Group name is required'], trim: true },
    contacts: {
      type: [contactSchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 1000;
        },
        message: 'Group contacts cannot exceed 1000',
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
