import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Dairy Cooperative Management System API' });
});

// Import routes
import farmerRoutes from './routes/farmerRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import accountingRoutes from './routes/accountingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import additionalRoutes from './routes/additionalRoutes.js';

import ledgerRoutes from './routes/ledgerRoutes.js';
import subsidyRoutes from './routes/subsidyRoutes.js';

// Use routes
app.use('/api/farmers', farmerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api', accountingRoutes);
app.use('/api', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', additionalRoutes);

app.use('/api', ledgerRoutes);
app.use('/api', subsidyRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
