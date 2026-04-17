require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { applyEnvironmentMode } = require('../config/appMode');
const { getMongoCandidates } = require('../config/mongoConfig');

applyEnvironmentMode(process.env);

// Allow overriding via CLI: node createUser.js <email> <password> <name> <role>
const email   = process.argv[2] || 'admin.ajith.muthukumar@gmail.com';
const password = process.argv[3] || 'Admin@12345';
const name    = process.argv[4] || 'Ajith Muthukumar';
const role    = process.argv[5] || 'admin';

const create = async () => {
  try {
    const { mode, options, candidates } = getMongoCandidates(process.env);
    if (!candidates.length) {
      throw new Error('No MongoDB connection string configured.');
    }

    let connected = false;
    let lastError;

    for (const candidate of candidates) {
      try {
        await mongoose.connect(candidate.uri, options);
        console.log(`Connected to MongoDB (${candidate.label}, mode=${mode})`);
        connected = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!connected) {
      throw lastError;
    }

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
