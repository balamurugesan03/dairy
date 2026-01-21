import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined');
  process.exit(1);
}

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

// Import auth middleware
import { protect, addCompanyFilter } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
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
import collectionCenterRoutes from './routes/collectionCenterRoutes.js';

// HRM routes
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import designationRoutes from './routes/designationRoutes.js';

// Company routes
import companyRoutes from './routes/companyRoutes.js';

// User Management routes
import userManagementRoutes from './routes/userManagementRoutes.js';

// Auth routes (public login, protected user management)
app.use('/api/auth', authRoutes);

// Apply authentication and company filter to all protected routes
app.use('/api/farmers', protect, addCompanyFilter, farmerRoutes);
app.use('/api/customers', protect, addCompanyFilter, customerRoutes);
app.use('/api/suppliers', protect, addCompanyFilter, supplierRoutes);
app.use('/api', protect, addCompanyFilter, inventoryRoutes);
app.use('/api/sales', protect, addCompanyFilter, salesRoutes);
app.use('/api', protect, addCompanyFilter, accountingRoutes);
app.use('/api', protect, addCompanyFilter, paymentRoutes);
app.use('/api/reports', protect, addCompanyFilter, reportRoutes);
app.use('/api', protect, addCompanyFilter, additionalRoutes);

app.use('/api', protect, addCompanyFilter, ledgerRoutes);
app.use('/api', protect, addCompanyFilter, subsidyRoutes);
app.use('/api/collection-centers', protect, addCompanyFilter, collectionCenterRoutes);

// HRM routes
app.use('/api/employees', protect, addCompanyFilter, employeeRoutes);
app.use('/api/attendance', protect, addCompanyFilter, attendanceRoutes);
app.use('/api/salary', protect, addCompanyFilter, salaryRoutes);
app.use('/api/leaves', protect, addCompanyFilter, leaveRoutes);
app.use('/api/departments', protect, addCompanyFilter, departmentRoutes);
app.use('/api/designations', protect, addCompanyFilter, designationRoutes);

// User Management routes (company admins can manage their users)
app.use('/api/user-management', userManagementRoutes);

// Company routes - public endpoint for active companies list, protected for other operations
import { getAllCompanies } from './controllers/companyController.js';

// Public endpoint - get active companies for login page (no auth required)
app.get('/api/companies/public', async (req, res) => {
  try {
    const Company = (await import('./models/Company.js')).default;
    const companies = await Company.find({ status: 'Active' })
      .select('companyName businessTypes _id')
      .sort({ companyName: 1 });
    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching public companies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies'
    });
  }
});

// Protected company routes (for superadmin management)
app.use('/api/companies', protect, companyRoutes);

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
