const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payments');
const contributionRoutes = require('./routes/contributions');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? ['https://your-flutter-app-domain.com'] // Replace with your Flutter app domain
    : true,
  credentials: true
}));

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Static files (for uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
const API_PREFIX = `/api/${config.API_VERSION}`;

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/profile`, profileRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/contributions`, contributionRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);

// Health check endpoint
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'MREDEO API is running',
    timestamp: new Date().toISOString(),
    version: config.API_VERSION
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
