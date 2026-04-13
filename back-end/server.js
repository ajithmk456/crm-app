const app = require('./app');
const { initializeReminders, cleanupAllReminders } = require('./services/reminderService');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log('Server running on http://localhost:' + PORT);
  console.log('Swagger docs available at http://localhost:' + PORT + '/api-docs');
  
  // Initialize task reminders
  try {
    await initializeReminders();
  } catch (error) {
    console.error('Failed to initialize reminders:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  cleanupAllReminders();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  cleanupAllReminders();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

