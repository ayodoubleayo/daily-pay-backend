require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const connectDB = require('./config/db');
const cookieParser = require('cookie-parser');

/* ---------------------------------------------------
   ENV VALIDATION
---------------------------------------------------- */
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_SECRET'];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    process.exit(1);
  }
});

/* ---------------------------------------------------
   EXPRESS APP INIT
---------------------------------------------------- */
const app = express();

// ✅ Correct placement — trust proxy must be AFTER app is created
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
app.use(cookieParser());

/* ---------------------------------------------------
   DATABASE
---------------------------------------------------- */
connectDB();

/* ---------------------------------------------------
   SECURITY MIDDLEWARES
---------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

app.use(mongoSanitize());
app.use(compression());

/* ---------------------------------------------------
   CORS CONFIG (supports Vercel wildcard)
---------------------------------------------------- */
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [
        'http://localhost:3000',
        'https://daily-pay-frontend.vercel.app',
        /\.vercel\.app$/, // wildcard for all Vercel preview URLs
      ];

      if (!origin) return callback(null, true);

      const isAllowed =
        allowed.includes(origin) ||
        allowed.some((entry) => entry instanceof RegExp && entry.test(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ---------------------------------------------------
   LOGGING
---------------------------------------------------- */
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/* ---------------------------------------------------
   STATIC
---------------------------------------------------- */
app.use('/uploads', express.static('uploads'));

/* ---------------------------------------------------
   ROUTES
---------------------------------------------------- */
app.use('/api/products', require('./routes/products'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sellers', require('./routes/sellers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/history', require('./routes/history'));
app.use('/api/payout-info', require('./routes/payouts'));
app.use('/api/bank-details', require('./routes/bankDetails'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/riders', require('./routes/riders'));

/* ---------------------------------------------------
   HEALTH CHECK
---------------------------------------------------- */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/* ---------------------------------------------------
   ROOT ROUTE (Render Fix)
---------------------------------------------------- */
app.get('/', (req, res) => {
  res.send('Backend is running ✔️');
});

/* ---------------------------------------------------
   404 HANDLER
---------------------------------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ---------------------------------------------------
   GLOBAL ERROR HANDLER
---------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

/* ---------------------------------------------------
   GRACEFUL SHUTDOWN
---------------------------------------------------- */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

/* ---------------------------------------------------
   START SERVER
---------------------------------------------------- */
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
