import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config();

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined');
  process.exit(1);
}

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io — allow frontend origin
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    // Drop old global unique indexes (replaced by compound indexes per companyId)
    const oldIndexes = [
      { collection: 'quotations',        index: 'quotationNumber_1' },
      { collection: 'items',             index: 'itemCode_1' },
      { collection: 'businessitems',     index: 'itemCode_1' },
      { collection: 'businesscustomers', index: 'customerId_1' },
      { collection: 'suppliers',         index: 'supplierId_1' },
      { collection: 'customers',         index: 'customerId_1' },
      { collection: 'businessledgers',   index: 'code_1' },
      { collection: 'businessledgers',   index: 'code_1_companyId_1' }, // old sparse→partialFilter fix
      { collection: 'businessledgers',   index: 'name_1' },
      { collection: 'businessvouchers',  index: 'voucherNumber_1' },
      { collection: 'sales',                    index: 'billNumber_1' },    // replaced by {billNumber,companyId} compound
      { collection: 'dairypurchasereturns',     index: 'returnNumber_1' },             // old global unique
      { collection: 'dairypurchasereturns',     index: 'returnNumber_1_companyId_1' }, // recreate with partialFilter
      { collection: 'dairysalesreturns',        index: 'returnNumber_1' },
      { collection: 'dairysalesreturns',        index: 'returnNumber_1_companyId_1' },
      { collection: 'purchasereturns',          index: 'returnNumber_1' },
      { collection: 'purchasereturns',          index: 'returnNumber_1_companyId_1' },
      { collection: 'salesreturns',             index: 'returnNumber_1' },
      { collection: 'salesreturns',             index: 'returnNumber_1_companyId_1' },
      { collection: 'milkcollections',          index: 'billNo_1' }, // replaced by compound {billNo,companyId}
      { collection: 'purchasereturns',          index: 'returnNumber_1' }, // replaced by compound {returnNumber,companyId}
      { collection: 'machines',                 index: 'machineId_1' },    // old field removed
      { collection: 'machines',                 index: 'machineCode_1' },  // replaced by sparse index
    ];
    for (const { collection, index } of oldIndexes) {
      try {
        await mongoose.connection.collection(collection).dropIndex(index);
        console.log(`Dropped old index ${index} on ${collection}`);
      } catch (e) {
        if (e.codeName !== 'IndexNotFound') console.warn(`Index drop warning (${collection}.${index}):`, e.message);
      }
    }
  })
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
import businessCustomerRoutes from './routes/businessCustomerRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import businessSupplierRoutes from './routes/businessSupplierRoutes.js';
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
import loanRoutes from './routes/loanRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import designationRoutes from './routes/designationRoutes.js';

// Company routes
import companyRoutes from './routes/companyRoutes.js';

// User Management routes
import userManagementRoutes from './routes/userManagementRoutes.js';

// Producer Loan and Receipt routes
import producerLoanRoutes from './routes/producerLoanRoutes.js';
import producerReceiptRoutes from './routes/producerReceiptRoutes.js';

// Producer Register routes
import producerRegisterRoutes from './routes/producerRegisterRoutes.js';

// Bank Transfer routes
import bankTransferRoutes from './routes/bankTransferRoutes.js';

// Business Inventory routes
import businessInventoryRoutes from './routes/businessInventoryRoutes.js';

// Business Sales routes
import businessSalesRoutes from './routes/businessSalesRoutes.js';

// Business Accounting routes
import businessAccountingRoutes from './routes/businessAccountingRoutes.js';

// Purchase Return routes
import purchaseReturnRoutes from './routes/purchaseReturnRoutes.js';

// Sales Return routes
import salesReturnRoutes from './routes/salesReturnRoutes.js';

// Dairy Return routes
import dairyPurchaseReturnRoutes from './routes/dairyPurchaseReturnRoutes.js';
import dairySalesReturnRoutes from './routes/dairySalesReturnRoutes.js';

// Business Promotion routes
import businessPromotionRoutes from './routes/businessPromotionRoutes.js';

// Rate Chart routes
import rateChartRoutes from './routes/rateChartRoutes.js';

// Milk Purchase Settings routes
import milkPurchaseSettingsRoutes from './routes/milkPurchaseSettingsRoutes.js';

// Milk Collection routes
import milkCollectionRoutes from './routes/milkCollectionRoutes.js';

// Agent routes
import agentRoutes from './routes/agentRoutes.js';

// Salesman routes
import salesmanRoutes from './routes/salesmanRoutes.js';

// Union Sales Slip routes
import unionSalesSlipRoutes from './routes/unionSalesSlipRoutes.js';

// Milk Sales routes (daily collection sales screen)
import milkSalesRoutes from './routes/milkSalesRoutes.js';

// Milk Sales Rate routes
import milkSalesRateRoutes from './routes/milkSalesRateRoutes.js';

// Shift Incentive routes
import shiftIncentiveRoutes from './routes/shiftIncentiveRoutes.js';

// Time Incentive routes
import timeIncentiveRoutes from './routes/timeIncentiveRoutes.js';

// Earning / Deduction Master routes
import earningDeductionRoutes from './routes/earningDeductionRoutes.js';

// Individual Deduction / Earning transaction routes
import individualDeductionEarningRoutes from './routes/individualDeductionEarningRoutes.js';

// Historical Rule routes
import historicalRuleRoutes from './routes/historicalRuleRoutes.js';

// Periodical Rule routes
import periodicalRuleRoutes from './routes/periodicalRuleRoutes.js';

// Thermal Print routes (no auth — local printer, same machine)
import thermalPrintRoutes from './routes/thermalPrintRoutes.js';

// Milk Analyzer routes
import milkAnalyzerRoutes from './routes/milkAnalyzerRoutes.js';

// Machine Config routes
import machineConfigRoutes from './routes/machineConfigRoutes.js';

// Society Info & Document Management routes
import societyInfoRoutes from './routes/societyInfoRoutes.js';

// Payment Register (Creditor Bill) routes
import paymentRegisterRoutes from './routes/paymentRegisterRoutes.js';

// Milk Bill Report routes
import milkBillRoutes from './routes/milkBillRoutes.js';

// Financial Year routes
import financialYearRoutes from './routes/financialYearRoutes.js';

// Dairy Settings routes (payment days, account start date, opening balances)
import dairySettingsRoutes from './routes/dairySettingsRoutes.js';

// Producer Payment routes
import producerPaymentRoutes from './routes/producerPaymentRoutes.js';

// Producer Opening routes
import producerOpeningRoutes from './routes/producerOpeningRoutes.js';

// Cattle Feed Advance routes
import cattleFeedAdvanceRoutes from './routes/cattleFeedAdvanceRoutes.js';

// Auth routes (public login, protected user management)
app.use('/api/auth', authRoutes);

// Public endpoint - get active companies for login page (no auth required)
// MUST be registered BEFORE any app.use('/api', protect, ...) middleware
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

// Thermal Print routes — MUST be before any app.use('/api', protect, ...) catch-all
app.use('/api/print', thermalPrintRoutes);

// Apply authentication and company filter to all protected routes
app.use('/api/farmers', protect, addCompanyFilter, farmerRoutes);
app.use('/api/customers', protect, addCompanyFilter, customerRoutes);
app.use('/api/business-customers', protect, addCompanyFilter, businessCustomerRoutes);
app.use('/api/suppliers', protect, addCompanyFilter, supplierRoutes);
app.use('/api/business-suppliers', protect, addCompanyFilter, businessSupplierRoutes);
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
app.use('/api/loans', protect, addCompanyFilter, loanRoutes);
app.use('/api/departments', protect, addCompanyFilter, departmentRoutes);
app.use('/api/designations', protect, addCompanyFilter, designationRoutes);

// User Management routes (company admins can manage their users)
app.use('/api/user-management', userManagementRoutes);

// Producer Loan and Receipt routes
app.use('/api', protect, addCompanyFilter, producerLoanRoutes);
app.use('/api', protect, addCompanyFilter, producerReceiptRoutes);

// Producer Register routes
app.use('/api/producer-register', protect, addCompanyFilter, producerRegisterRoutes);

// Bank Transfer routes
app.use('/api', protect, addCompanyFilter, bankTransferRoutes);

// Business Inventory routes
app.use('/api/business-inventory', protect, addCompanyFilter, businessInventoryRoutes);

// Business Sales routes
app.use('/api/business-sales', protect, addCompanyFilter, businessSalesRoutes);

// Business Accounting routes
app.use('/api/business-accounting', protect, addCompanyFilter, businessAccountingRoutes);

// Purchase Return routes
app.use('/api/purchase-returns', protect, addCompanyFilter, purchaseReturnRoutes);

// Sales Return routes
app.use('/api/sales-returns', protect, addCompanyFilter, salesReturnRoutes);

// Dairy Return routes
app.use('/api/dairy-purchase-returns', protect, addCompanyFilter, dairyPurchaseReturnRoutes);
app.use('/api/dairy-sales-returns', protect, addCompanyFilter, dairySalesReturnRoutes);

// Business Promotion routes
app.use('/api/business-promotions', protect, addCompanyFilter, businessPromotionRoutes);

// Rate Chart routes
app.use('/api/rate-charts', protect, addCompanyFilter, rateChartRoutes);

// Milk Purchase Settings routes
app.use('/api/milk-purchase-settings', protect, addCompanyFilter, milkPurchaseSettingsRoutes);

// Milk Collection routes
app.use('/api/milk-collections', protect, addCompanyFilter, milkCollectionRoutes);

// Agent routes
app.use('/api/agents', protect, addCompanyFilter, agentRoutes);

// Salesman routes
app.use('/api/salesman', protect, addCompanyFilter, salesmanRoutes);

// Union Sales Slip routes
app.use('/api/union-sales-slips', protect, addCompanyFilter, unionSalesSlipRoutes);

// Milk Sales routes (daily collection sales screen)
app.use('/api/milk-sales', protect, addCompanyFilter, milkSalesRoutes);

// Milk Sales Rate routes
app.use('/api/milk-sales-rates', protect, addCompanyFilter, milkSalesRateRoutes);

// Shift Incentive routes
app.use('/api/shift-incentives', protect, addCompanyFilter, shiftIncentiveRoutes);

// Time Incentive routes
app.use('/api/time-incentives', protect, addCompanyFilter, timeIncentiveRoutes);

// Earning / Deduction Master routes
app.use('/api/earning-deductions', protect, addCompanyFilter, earningDeductionRoutes);

// Individual Deduction / Earning transactions
app.use('/api/individual-transactions', protect, addCompanyFilter, individualDeductionEarningRoutes);

// Historical Rules
app.use('/api/historical-rules', protect, addCompanyFilter, historicalRuleRoutes);

// Periodical Rules
app.use('/api/periodical-rules', protect, addCompanyFilter, periodicalRuleRoutes);

// Milk Analyzer routes
app.use('/api/milk-analyzer', protect, addCompanyFilter, milkAnalyzerRoutes);

// Machine Config routes (analyzer device configuration + start/stop)
app.use('/api/machine-config', protect, addCompanyFilter, machineConfigRoutes);

// Society Info & Document Management routes
app.use('/api/society-info', protect, addCompanyFilter, societyInfoRoutes);

// Payment Register (Creditor Bill) routes
app.use('/api/payment-register', protect, addCompanyFilter, paymentRegisterRoutes);

// Milk Bill Report routes
app.use('/api/milk-bill', protect, addCompanyFilter, milkBillRoutes);

// Financial Year routes
app.use('/api/financial-years', protect, addCompanyFilter, financialYearRoutes);

// Dairy Settings routes
app.use('/api/dairy-settings', protect, addCompanyFilter, dairySettingsRoutes);

// Producer Payment routes
app.use('/api', protect, addCompanyFilter, producerPaymentRoutes);

// Producer Opening routes
app.use('/api', protect, addCompanyFilter, producerOpeningRoutes);

// Cattle Feed Advance routes
app.use('/api/cattle-feed-advance', protect, addCompanyFilter, cattleFeedAdvanceRoutes);

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
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  console.log('[SerialPort] Analyzer managed via /api/machine-config (DB-driven, start/stop from UI).');
});

export default app;
