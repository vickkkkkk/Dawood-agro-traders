import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

import config from './config/index.js';
import errorHandler from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import billingRoutes from './routes/billing.js';
import inventoryRoutes from './routes/inventory.js';
import customerRoutes from './routes/customers.js';
import creditRoutes from './routes/credits.js';
import purchaseRoutes from './routes/purchases.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// --- Global Middleware ---

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dawood AGRO TRADERS API is running.',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api', billingRoutes);
app.use('/api', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api', purchaseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// --- Serve Frontend in Production ---
if (config.nodeEnv === 'production') {
  const clientDistPath = join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDistPath));

  // Catch-all for SPA routing
  app.get('(.*)', (req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'));
  });
}

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Start Server ---
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Dawood AGRO TRADERS Server`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
  console.log(`   CORS Origin: ${config.corsOrigin}\n`);
});

export default app;
// Force nodemon restart to pick up updated Prisma client dll

