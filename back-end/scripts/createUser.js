require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const create = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = await User.findOne({ email: 'dev.ajith.muthukumar@gmail.com' });
    if (existing) {
      console.log('User already exists:', existing.email);
      process.exit(0);
    }

    const user = new User({
      name: 'dev.ajith.muthukumar@gmail.com',
      email: 'dev.ajith.muthukumar@gmail.com',
      password: '12345',
      role: 'admin'
    });
    await user.save();

    console.log('User created:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err);
    process.exit(1);
  }
};

create();