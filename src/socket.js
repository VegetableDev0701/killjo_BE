const { Server } = require('socket.io');
const userStatsService = require('./services/userStatsService');

let io;

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle user count request - the main event
    socket.on('getUserCount', async () => {
      console.log('Client requested user count:', socket.id);
      try {
        const count = await userStatsService.getTotalRegisteredUsers();
        
        socket.emit('userCountUpdate', {
          totalUsers: count,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling user count request:', error);
        socket.emit('error', {
          message: 'Failed to get user count',
          error: error.message
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('Socket.io server initialized');
  return io;
}

/**
 * Broadcast user count update to all connected clients
 * @param {number} count - User count
 */
async function broadcastUserCount(count) {
  if (io) {
    const data = {
      totalUsers: count,
      timestamp: new Date().toISOString()
    };
    io.emit('userCountUpdate', data);
    console.log('User count update broadcasted to all clients:', count);
  }
}

module.exports = {
  initializeSocket,
  broadcastUserCount,
  getIO: () => io
};