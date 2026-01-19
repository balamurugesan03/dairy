import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout to prevent hanging
  headers: {
    'Content-Type': 'application/json'
  }
});

// Error handler
const handleError = (error) => {
  if (error.response) {
    throw error.response.data;
  } else if (error.request) {
    throw { message: 'Network error. Please check your connection.' };
  } else {
    throw { message: error.message };
  }
};

// FARMER APIs
export const farmerAPI = {
  getAll: (params) => api.get('/farmers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/farmers/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/farmers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/farmers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/farmers/${id}`).then(res => res.data).catch(handleError),
  toggleMembership: (id) => api.patch(`/farmers/${id}/membership`).then(res => res.data).catch(handleError),
  search: (query) => {
    // Validate query parameter - must be non-empty string
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/farmers/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  },
  addShares: (id, data) => api.post(`/farmers/${id}/shares`, data).then(res => res.data).catch(handleError),
  getShareHistory: (id) => api.get(`/farmers/${id}/shares`).then(res => res.data).catch(handleError),
  terminate: (id, data) => api.post(`/farmers/${id}/terminate`, data).then(res => res.data).catch(handleError),
  bulkImport: (farmers) => api.post('/farmers/bulk-import', { farmers }).then(res => res.data).catch(handleError)
};

// CUSTOMER APIs
export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/customers/${id}`).then(res => res.data).catch(handleError),
  getByCustomerId: (customerId) => api.get(`/customers/customerId/${customerId}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/customers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/customers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/customers/${id}`).then(res => res.data).catch(handleError),
  search: (query) => {
    // Validate query parameter - must be non-empty string
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/customers/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  }
};

// SUPPLIER APIs
export const supplierAPI = {
  getAll: (params) => api.get('/suppliers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/suppliers/${id}`).then(res => res.data).catch(handleError),
  getBySupplierId: (supplierId) => api.get(`/suppliers/supplierId/${supplierId}`).then(res => res.data).catch(handleError),
  getNextId: () => api.get('/suppliers/next-id').then(res => res.data).catch(handleError),
  create: (data) => api.post('/suppliers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/suppliers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/suppliers/${id}`).then(res => res.data).catch(handleError),
  search: (query) => {
    // Validate query parameter - must be non-empty string
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/suppliers/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  }
};

// ITEM APIs
export const itemAPI = {
  getAll: (params) => api.get('/items', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/items/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/items', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/items/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/items/${id}`).then(res => res.data).catch(handleError),
  updateOpeningBalance: (id, data) => api.patch(`/items/${id}/opening-balance`, data).then(res => res.data).catch(handleError),
  updateSalesPrice: (id, data) => api.patch(`/items/${id}/sales-price`, data).then(res => res.data).catch(handleError)
};

// STOCK APIs
export const stockAPI = {
  stockIn: (data) => api.post('/stock/in', data).then(res => res.data).catch(handleError),
  stockOut: (data) => api.post('/stock/out', data).then(res => res.data).catch(handleError),
  getTransactions: (params) => api.get('/stock/transactions', { params }).then(res => res.data).catch(handleError),
  getBalance: (params) => api.get('/stock/balance', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/stock/transactions/${id}`).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/stock/transactions/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/stock/transactions/${id}`).then(res => res.data).catch(handleError)
};

// SALES APIs
export const salesAPI = {
  getAll: (params) => api.get('/sales', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/sales/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/sales', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/sales/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/sales/${id}`).then(res => res.data).catch(handleError),
  getCustomerHistory: (customerId) => api.get(`/sales/customer/${customerId}`).then(res => res.data).catch(handleError)
};

// VOUCHER APIs
export const voucherAPI = {
  getAll: (params) => api.get('/vouchers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/vouchers/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/vouchers', data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/vouchers/${id}`).then(res => res.data).catch(handleError)
};

// LEDGER APIs
export const ledgerAPI = {
  getAll: (params) => api.get('/ledgers', { params }).then(res => res.data).catch(handleError),
  getById: (id, params) => api.get(`/ledgers/${id}`, { params }).then(res => res.data).catch(handleError),
  create: (data) => api.post('/ledgers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/ledgers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/ledgers/${id}`).then(res => res.data).catch(handleError),
  getOutstanding: (id) => api.get(`/ledgers/${id}/outstanding`).then(res => res.data).catch(handleError)
};

// FARMER PAYMENT APIs
export const paymentAPI = {
  getAll: (params) => api.get('/farmer-payments', { params }).then(res => res.data).catch(handleError),
  create: (data) => api.post('/farmer-payments', data).then(res => res.data).catch(handleError),
  getFarmerHistory: (farmerId) => api.get(`/farmer-payments/farmer/${farmerId}`).then(res => res.data).catch(handleError)
};

// ADVANCE APIs
export const advanceAPI = {
  getAll: (params) => api.get('/advances', { params }).then(res => res.data).catch(handleError),
  create: (data) => api.post('/advances', data).then(res => res.data).catch(handleError),
  getFarmerAdvances: (farmerId, params) => api.get(`/advances/farmer/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  adjust: (id, data) => api.post(`/advances/${id}/adjust`, data).then(res => res.data).catch(handleError)
};

// REPORTS APIs
export const reportAPI = {
  receiptsDisbursement: (params) => api.get('/reports/receipts-disbursement', { params }).then(res => res.data).catch(handleError),
  tradingAccount: (params) => api.get('/reports/trading-account', { params }).then(res => res.data).catch(handleError),
  profitLoss: (params) => api.get('/reports/profit-loss', { params }).then(res => res.data).catch(handleError),
  balanceSheet: () => api.get('/reports/balance-sheet').then(res => res.data).catch(handleError),
  sales: (params) => api.get('/reports/sales', { params }).then(res => res.data).catch(handleError),
  stock: (params) => api.get('/reports/stock', { params }).then(res => res.data).catch(handleError),
  subsidy: (params) => api.get('/reports/subsidy', { params }).then(res => res.data).catch(handleError),
  stockRegister: (params) => api.get('/reports/stock-register', { params }).then(res => res.data).catch(handleError),
  inventoryPurchaseRegister: (params) => api.get('/reports/inventory-purchase-register', { params }).then(res => res.data).catch(handleError),
  // New accounting reports
  cashBook: (params) => api.get('/reports/cash-book', { params }).then(res => res.data).catch(handleError),
  generalLedger: (params) => api.get('/reports/general-ledger', { params }).then(res => res.data).catch(handleError),
  ledgerAbstract: (params) => api.get('/reports/ledger-abstract', { params }).then(res => res.data).catch(handleError),
  rdEnhanced: (params) => api.get('/reports/rd-enhanced', { params }).then(res => res.data).catch(handleError),
  ledgersDropdown: (params) => api.get('/reports/ledgers-dropdown', { params }).then(res => res.data).catch(handleError),
  // Vyapar Reports - Private Firm
  vyaparSaleReport: (params) => api.get('/reports/vyapar/sale-report', { params }).then(res => res.data).catch(handleError),
  vyaparPurchaseReport: (params) => api.get('/reports/vyapar/purchase-report', { params }).then(res => res.data).catch(handleError),
  vyaparPartyStatement: (params) => api.get('/reports/vyapar/party-statement', { params }).then(res => res.data).catch(handleError),
  vyaparCashflow: (params) => api.get('/reports/vyapar/cashflow', { params }).then(res => res.data).catch(handleError),
  vyaparAllTransactions: (params) => api.get('/reports/vyapar/all-transactions', { params }).then(res => res.data).catch(handleError),
  vyaparProfitLoss: (params) => api.get('/reports/vyapar/profit-loss', { params }).then(res => res.data).catch(handleError),
  vyaparBalanceSheet: (params) => api.get('/reports/vyapar/balance-sheet', { params }).then(res => res.data).catch(handleError),
  vyaparBillWiseProfit: (params) => api.get('/reports/vyapar/bill-profit', { params }).then(res => res.data).catch(handleError),
  vyaparPartyWiseProfit: (params) => api.get('/reports/vyapar/party-profit', { params }).then(res => res.data).catch(handleError),
  vyaparTrialBalance: (params) => api.get('/reports/vyapar/trial-balance', { params }).then(res => res.data).catch(handleError),
  vyaparStockSummary: (params) => api.get('/reports/vyapar/stock-summary', { params }).then(res => res.data).catch(handleError),
  vyaparItemByParty: (params) => api.get('/reports/vyapar/item-by-party', { params }).then(res => res.data).catch(handleError),
  vyaparItemWiseProfit: (params) => api.get('/reports/vyapar/item-profit', { params }).then(res => res.data).catch(handleError),
  vyaparLowStockSummary: (params) => api.get('/reports/vyapar/low-stock', { params }).then(res => res.data).catch(handleError),
  vyaparBankStatement: (params) => api.get('/reports/vyapar/bank-statement', { params }).then(res => res.data).catch(handleError),
  vyaparAllParties: (params) => api.get('/reports/vyapar/all-parties', { params }).then(res => res.data).catch(handleError)
};

// DAY BOOK API
export const dayBookAPI = {
  get: (params) => api.get('/reports/day-book', { params }).then(res => res.data).catch(handleError)
};

// WARRANTY APIs
export const warrantyAPI = {
  getAll: (params) => api.get('/warranty', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/warranty/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/warranty', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/warranty/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/warranty/${id}`).then(res => res.data).catch(handleError)
};

// MACHINE APIs
export const machineAPI = {
  getAll: (params) => api.get('/machines', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/machines/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/machines', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/machines/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/machines/${id}`).then(res => res.data).catch(handleError)
};

// QUOTATION APIs
export const quotationAPI = {
  getAll: (params) => api.get('/quotations', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/quotations/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/quotations', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/quotations/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/quotations/${id}`).then(res => res.data).catch(handleError)
};

// PROMOTION APIs
export const promotionAPI = {
  getAll: (params) => api.get('/promotions', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/promotions/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/promotions', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/promotions/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/promotions/${id}`).then(res => res.data).catch(handleError)
};

// CLASSIFIED CASH BOOK APIs
export const classifiedCashBookAPI = {
  // Create receipt
  createReceipt: (data) => api.post('/cashbook/receipts', data).then(res => res.data).catch(handleError),

  // Create disbursement
  createDisbursement: (data) => api.post('/cashbook/disbursements', data).then(res => res.data).catch(handleError),

  // Get all transactions
  getAllTransactions: (params) => api.get('/cashbook/transactions', { params }).then(res => res.data).catch(handleError),

  // Get transaction by ID
  getTransactionById: (id) => api.get(`/cashbook/transactions/${id}`).then(res => res.data).catch(handleError),

  // Delete transaction
  deleteTransaction: (id) => api.delete(`/cashbook/transactions/${id}`).then(res => res.data).catch(handleError),

  // Get cash book report
  getCashBookReport: (params) => api.get('/cashbook/cashbook-report', { params }).then(res => res.data).catch(handleError),

  // Get classification report
  getClassificationReport: (params) => api.get('/cashbook/classification-report', { params }).then(res => res.data).catch(handleError)
};

// SUBSIDY APIs
export const subsidyAPI = {
  getAll: (params) => api.get('/subsidies', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/subsidies/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/subsidies', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/subsidies/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/subsidies/${id}`).then(res => res.data).catch(handleError)
};

// COLLECTION CENTER APIs
export const collectionCenterAPI = {
  getAll: (params) => api.get('/collection-centers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/collection-centers/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/collection-centers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/collection-centers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/collection-centers/${id}`).then(res => res.data).catch(handleError),
  toggleStatus: (id) => api.patch(`/collection-centers/${id}/status`).then(res => res.data).catch(handleError)
};

// MILK COLLECTION APIs
export const milkCollectionAPI = {
  getAll: (params) => api.get('/milk-collections', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/milk-collections/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/milk-collections', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/milk-collections/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/milk-collections/${id}`).then(res => res.data).catch(handleError),
  getFarmerHistory: (farmerNumber, params) => api.get(`/milk-collections/farmer/${farmerNumber}`, { params }).then(res => res.data).catch(handleError),
  getFarmerStats: (farmerNumber, params) => api.get(`/milk-collections/farmer/${farmerNumber}/stats`, { params }).then(res => res.data).catch(handleError)
};

// EMPLOYEE APIs
export const employeeAPI = {
  getAll: (params) => api.get('/employees', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/employees/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/employees', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/employees/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/employees/${id}`).then(res => res.data).catch(handleError),
  search: (query) => {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/employees/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  },
  getStatistics: () => api.get('/employees/statistics').then(res => res.data).catch(handleError),
  updateStatus: (id, status) => api.patch(`/employees/${id}/status`, { status }).then(res => res.data).catch(handleError)
};

// DEPARTMENT APIs
export const departmentAPI = {
  getAll: (params) => api.get('/departments', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/departments/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/departments', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/departments/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/departments/${id}`).then(res => res.data).catch(handleError),
  getActive: () => api.get('/departments/active').then(res => res.data).catch(handleError)
};

// DESIGNATION APIs
export const designationAPI = {
  getAll: (params) => api.get('/designations', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/designations/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/designations', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/designations/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/designations/${id}`).then(res => res.data).catch(handleError),
  getActive: (params) => api.get('/designations/active', { params }).then(res => res.data).catch(handleError)
};

// ATTENDANCE APIs
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/attendance/${id}`).then(res => res.data).catch(handleError),
  mark: (data) => api.post('/attendance', data).then(res => res.data).catch(handleError),
  bulkMark: (data) => api.post('/attendance/bulk', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/attendance/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/attendance/${id}`).then(res => res.data).catch(handleError),
  getByDate: (date) => api.get('/attendance/by-date', { params: { date } }).then(res => res.data).catch(handleError),
  getMonthlySummary: (employeeId, month, year) => api.get(`/attendance/${employeeId}/summary`, { params: { month, year } }).then(res => res.data).catch(handleError),
  getReport: (params) => api.get('/attendance/report', { params }).then(res => res.data).catch(handleError)
};

// SALARY APIs
export const salaryAPI = {
  getAll: (params) => api.get('/salary', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/salary/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/salary', data).then(res => res.data).catch(handleError),
  process: (data) => api.post('/salary/process', data).then(res => res.data).catch(handleError),
  bulkProcess: (data) => api.post('/salary/bulk-process', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/salary/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/salary/${id}`).then(res => res.data).catch(handleError),
  approve: (id, approvedBy) => api.patch(`/salary/${id}/approve`, { approvedBy }).then(res => res.data).catch(handleError),
  markPaid: (id, data) => api.patch(`/salary/${id}/mark-paid`, data).then(res => res.data).catch(handleError),
  generatePayslip: (id) => api.patch(`/salary/${id}/generate-payslip`).then(res => res.data).catch(handleError),
  getPending: () => api.get('/salary/pending').then(res => res.data).catch(handleError),
  getUnpaid: () => api.get('/salary/unpaid').then(res => res.data).catch(handleError)
};

// LEAVE APIs
export const leaveAPI = {
  getAll: (params) => api.get('/leaves', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/leaves/${id}`).then(res => res.data).catch(handleError),
  apply: (data) => api.post('/leaves', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/leaves/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/leaves/${id}`).then(res => res.data).catch(handleError),
  approve: (id, data) => api.patch(`/leaves/${id}/approve`, data).then(res => res.data).catch(handleError),
  reject: (id, data) => api.patch(`/leaves/${id}/reject`, data).then(res => res.data).catch(handleError),
  cancel: (id) => api.patch(`/leaves/${id}/cancel`).then(res => res.data).catch(handleError),
  getPending: () => api.get('/leaves/pending').then(res => res.data).catch(handleError),
  getUpcoming: () => api.get('/leaves/upcoming').then(res => res.data).catch(handleError),
  getSummary: (employeeId, params) => api.get(`/leaves/${employeeId}/summary`, { params }).then(res => res.data).catch(handleError)
};

// COMPANY APIs
export const companyAPI = {
  getAll: (params) => api.get('/companies', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/companies/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/companies', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/companies/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/companies/${id}`).then(res => res.data).catch(handleError),
  getStats: () => api.get('/companies/stats').then(res => res.data).catch(handleError)
};

export default api;
