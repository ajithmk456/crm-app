require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Allow overriding via CLI: node createUser.js <email> <password> <name> <role>
const email   = process.argv[2] || 'admin.ajith.muthukumar@gmail.com';
const password = process.argv[3] || 'Admin@12345';
const name    = process.argv[4] || 'Ajith Muthukumar';
const role    = process.argv[5] || 'Admin';

const create = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('User already exists:', existing.email);
      process.exit(0);
    }

    const user = new User({ name, email, password, role });
    await user.save();

    console.log('User created successfully!');
    console.log('  Email :', user.email);
    console.log('  Role  :', user.role);
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err.message);
    process.exit(1);
  }
};

create();
