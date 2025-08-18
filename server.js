const app = require('./src/app');
const config = require('./src/config/environment');
const db = require('./src/config/database');

// Test database connection
const testConnection = async () => {
  try {
    const client = await db.connect();
    console.log('✅ Database connected successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('🔌 HTTP server closed');
    
    db.end(() => {
      console.log('🗄️ Database connection closed');
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
  });

  // Force close server after 30 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle process termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  await testConnection();
  
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log('🚀 MREDEO Backend Server Started');
    console.log(`📍 Environment: ${config.NODE_ENV}`);
    console.log(`🌐 Server running on port: ${config.PORT}`);
    console.log(`📡 Local API: http://localhost:${config.PORT}/api/${config.API_VERSION}`);
    console.log(`🌍 Network API: http://0.0.0.0:${config.PORT}/api/${config.API_VERSION}`);
    console.log(`🏥 Health Check: http://localhost:${config.PORT}/api/${config.API_VERSION}/health`);
  });

  // Make server globally available for graceful shutdown
  global.server = server;
};

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
