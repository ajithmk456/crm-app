const mongoose = require('mongoose');
const { getMongoCandidates } = require('./mongoConfig');

const connectDB = async () => {
  const { mode, options, candidates } = getMongoCandidates(process.env);

  if (!candidates.length) {
    throw new Error('No MongoDB connection string configured. Set MONGO_URI_LOCAL, MONGO_URI_CLOUD, or MONGO_URI.');
  }

  let lastError;

  for (const candidate of candidates) {
    try {
      const conn = await mongoose.connect(candidate.uri, options);
      console.log(`MongoDB connected (${candidate.label}): ${conn.connection.host}`);
      return conn;
    } catch (error) {
      lastError = error;
      console.error(`MongoDB connection failed (${candidate.label}, mode=${mode}): ${error.message}`);
    }
  }

  throw lastError;
};

module.exports = connectDB;
