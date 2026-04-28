let io = null;

const setSocketServer = (socketServer) => {
  io = socketServer;
};

const emitChatUpdate = (event) => {
  if (!io) {
    return;
  }

  io.emit('chat:update', {
    ...event,
    timestamp: event?.timestamp || new Date().toISOString(),
  });
};

module.exports = {
  setSocketServer,
  emitChatUpdate,
};
