const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./src/routes/auth');
const accessControlRoutes = require('./src/routes/access-control');
const clinicOperationsRoutes = require('./src/routes/clinic-operations');
const medicalRecordsRoutes = require('./src/routes/medical-records');
const prescriptionRoutes = require('./src/routes/prescriptions');
const insuranceRoutes = require('./src/routes/insurance');
const notificationRoutes = require('./src/routes/notifications');
const appointmentRoutes = require('./src/routes/appointments');
const { authenticate } = require('./src/middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://3.144.150.239',
      'http://ec2-3-144-150-239.us-east-2.compute.amazonaws.com',
      'http://ec2-3-22-13-29.us-east-2.compute.amazonaws.com',
      // Allow any localhost with any port for development
      /^http:\/\/localhost:\d+$/,
      // Allow EC2 instances with any path
      /^https?:\/\/ec2-[\d-]+\.us-east-2\.compute\.amazonaws\.com/,
      // Allow IP addresses (for QA/public IP access)
      /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    ];
    
    // Check if origin is in allowed list or matches pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed || origin.includes(allowed.replace('http://', '').replace('https://', ''));
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // For development, allow all (remove in production)
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from Assets directory
const path = require('path');
app.use('/assets', express.static(path.join(__dirname, 'Assets')));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/access-control', accessControlRoutes);
app.use('/api/clinic-operations', clinicOperationsRoutes);
app.use('/api/medical-records', medicalRecordsRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/api/protected', authenticate, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 MediConnect Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API endpoints available under /api`);
});

module.exports = app;
