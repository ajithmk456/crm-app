require('dotenv').config();
const { applyEnvironmentMode } = require('./config/appMode');

applyEnvironmentMode(process.env);

const app = require('./app');
const connectDB = require('./config/db');
const { initializeReminders, cleanupAllReminders } = require('./services/reminderService');
const { ensureDefaultSuperadmin } = require('./services/superadminService');

const PORT = process.env.PORT || 3000;

let server;

const startServer = async () => {
  try {
    await connectDB();
    await ensureDefaultSuperadmin();

    server = app.listen(PORT, async () => {
      console.log('Server running on http://localhost:' + PORT);
      console.log('Swagger docs available at http://localhost:' + PORT + '/api-docs');

      try {
        await initializeReminders();
      } catch (error) {
        console.error('Failed to initialize reminders:', error.message);
      }
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  cleanupAllReminders();
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  cleanupAllReminders();
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

