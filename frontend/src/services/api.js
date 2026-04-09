import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Public API instance - NO auth token (for login page, etc.)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Authenticated API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout to prevent hanging
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('selectedCompanyId');
      localStorage.removeItem('selectedBusinessType');
      // Redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

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

// AUTH APIs
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }).then(res => res.data).catch(handleError),
  getMe: () => api.get('/auth/me').then(res => res.data).catch(handleError),
  changePassword: (currentPassword, newPassword) => api.patch('/auth/change-password', { currentPassword, newPassword }).then(res => res.data).catch(handleError),
  // User Management (superadmin only)
  getUsers: (params) => api.get('/auth/users', { params }).then(res => res.data).catch(handleError),
  getUser: (id) => api.get(`/auth/users/${id}`).then(res => res.data).catch(handleError),
  createUser: (data) => api.post('/auth/users', data).then(res => res.data).catch(handleError),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data).then(res => res.data).catch(handleError),
  resetPassword: (id, newPassword) => api.patch(`/auth/users/${id}/reset-password`, { newPassword }).then(res => res.data).catch(handleError),
  deleteUser: (id) => api.delete(`/auth/users/${id}`).then(res => res.data).catch(handleError)
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

// BUSINESS CUSTOMER APIs (Private Firm)
export const businessCustomerAPI = {
  getAll: (params) => api.get('/business-customers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-customers/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-customers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-customers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-customers/${id}`).then(res => res.data).catch(handleError),
  search: (query) => api.get('/business-customers/search', { params: { query } }).then(res => res.data).catch(handleError)
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
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/suppliers/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  }
};

export const businessSupplierAPI = {
  getAll: (params) => api.get('/business-suppliers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-suppliers/${id}`).then(res => res.data).catch(handleError),
  getNextId: () => api.get('/business-suppliers/next-id').then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-suppliers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-suppliers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-suppliers/${id}`).then(res => res.data).catch(handleError),
  search: (query) => api.get('/business-suppliers/search', { params: { query } }).then(res => res.data).catch(handleError)
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
  getById: (id) => api.get(`/farmer-payments/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/farmer-payments', data).then(res => res.data).catch(handleError),
  bulkCreate: (payments) => api.post('/farmer-payments/bulk', { payments }).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/farmer-payments/${id}`, data).then(res => res.data).catch(handleError),
  cancel: (id, cancellationReason) => api.post(`/farmer-payments/${id}/cancel`, { cancellationReason }).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/farmer-payments/${id}`).then(res => res.data).catch(handleError),
  getFarmerHistory: (farmerId, params) => api.get(`/farmer-payments/farmer/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  getStats: (params) => api.get('/farmer-payments/stats', { params }).then(res => res.data).catch(handleError)
};

// ADVANCE APIs
export const advanceAPI = {
  getAll: (params) => api.get('/advances', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/advances/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/advances', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/advances/${id}`, data).then(res => res.data).catch(handleError),
  cancel: (id, cancellationReason) => api.post(`/advances/${id}/cancel`, { cancellationReason }).then(res => res.data).catch(handleError),
  getFarmerAdvances: (farmerId, params) => api.get(`/advances/farmer/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  adjust: (id, data) => api.post(`/advances/${id}/adjust`, data).then(res => res.data).catch(handleError),
  getStats: (params) => api.get('/advances/stats', { params }).then(res => res.data).catch(handleError)
};

// REPORTS APIs
export const reportAPI = {
  receiptsDisbursement: (params) => api.get('/reports/receipts-disbursement', { params }).then(res => res.data).catch(handleError),
  tradingAccount: (params) => api.get('/reports/trading-account', { params }).then(res => res.data).catch(handleError),
  profitLoss: (params) => api.get('/reports/profit-loss', { params }).then(res => res.data).catch(handleError),
  balanceSheet: (params) => api.get('/reports/balance-sheet', { params }).then(res => res.data).catch(handleError),
  sales: (params) => api.get('/reports/sales', { params }).then(res => res.data).catch(handleError),
  stock: (params) => api.get('/reports/stock', { params }).then(res => res.data).catch(handleError),
  subsidy: (params) => api.get('/reports/subsidy', { params }).then(res => res.data).catch(handleError),
  stockRegister: (params) => api.get('/reports/stock-register', { params }).then(res => res.data).catch(handleError),
  inventoryPurchaseRegister: (params) => api.get('/reports/inventory-purchase-register', { params }).then(res => res.data).catch(handleError),
  milkBillAbstract: (params) => api.get('/reports/milk-bill-abstract', { params }).then(res => res.data).catch(handleError),
  dairyAbstract: (params) => api.get('/reports/dairy-abstract', { params }).then(res => res.data).catch(handleError),
  dairyRegister: (params) => api.get('/reports/dairy-register', { params }).then(res => res.data).catch(handleError),
  cooperativeRD: (params) => api.get('/reports/cooperative-rd', { params }).then(res => res.data).catch(handleError),
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
  vyaparCashInHand: (params) => api.get('/reports/vyapar/cash-in-hand', { params }).then(res => res.data).catch(handleError),
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
  vyaparAllParties: (params) => api.get('/reports/vyapar/all-parties', { params }).then(res => res.data).catch(handleError),
  vyaparGSTR1: (params) => api.get('/reports/vyapar/gstr1', { params }).then(res => res.data).catch(handleError),
  vyaparGSTR2: (params) => api.get('/reports/vyapar/gstr2', { params }).then(res => res.data).catch(handleError),
  vyaparStockStatement: (params) => api.get('/reports/vyapar/stock-statement', { params }).then(res => res.data).catch(handleError),
  vyaparDayBook: (params) => api.get('/reports/vyapar/day-book', { params }).then(res => res.data).catch(handleError),
  vyaparCashBook: (params) => api.get('/reports/vyapar/cash-book', { params }).then(res => res.data).catch(handleError),
  vyaparTradingAccount: (params) => api.get('/reports/vyapar/trading-account', { params }).then(res => res.data).catch(handleError),
  vyaparRD: (params) => api.get('/reports/vyapar/rd', { params }).then(res => res.data).catch(handleError),
  salesRegister: (params) => api.get('/reports/sales-register', { params }).then(res => res.data).catch(handleError)
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
  delete: (id) => api.delete(`/warranty/${id}`).then(res => res.data).catch(handleError),
  addClaim: (id, data) => api.post(`/warranty/${id}/claims`, data).then(res => res.data).catch(handleError),
  updateClaim: (id, claimId, data) => api.put(`/warranty/${id}/claims/${claimId}`, data).then(res => res.data).catch(handleError)
};

// MACHINE APIs
export const machineAPI = {
  getAll: (params) => api.get('/machines', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/machines/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/machines', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/machines/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/machines/${id}`).then(res => res.data).catch(handleError),
  addMaintenance: (id, data) => api.post(`/machines/${id}/maintenance`, data).then(res => res.data).catch(handleError),
  updateMaintenance: (id, logId, data) => api.put(`/machines/${id}/maintenance/${logId}`, data).then(res => res.data).catch(handleError)
};

// QUOTATION APIs
export const quotationAPI = {
  getAll: (params) => api.get('/quotations', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/quotations/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/quotations', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/quotations/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/quotations/${id}`).then(res => res.data).catch(handleError),
  convertToInvoice: (id, data) => api.post(`/quotations/${id}/convert`, data).then(res => res.data).catch(handleError),
  send: (id, data) => api.post(`/quotations/${id}/send`, data).then(res => res.data).catch(handleError)
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
  getFarmerStats: (farmerNumber, params) => api.get(`/milk-collections/farmer/${farmerNumber}/stats`, { params }).then(res => res.data).catch(handleError),
  getFarmerWiseSummary: (params) => api.get('/milk-collections/summary/farmer-wise', { params }).then(res => res.data).catch(handleError),
};

// MILK SALES APIs
export const milkSalesAPI = {
  getAll:  (params) => api.get('/milk-sales', { params }).then(res => res.data).catch(handleError),
  getById: (id)     => api.get(`/milk-sales/${id}`).then(res => res.data).catch(handleError),
  create:  (data)   => api.post('/milk-sales', data).then(res => res.data).catch(handleError),
  update:  (id, data) => api.put(`/milk-sales/${id}`, data).then(res => res.data).catch(handleError),
  delete:  (id)     => api.delete(`/milk-sales/${id}`).then(res => res.data).catch(handleError),
  getDailySummary:  (params) => api.get('/milk-sales/summary/daily',  { params }).then(res => res.data).catch(handleError),
  getBalanceReport: (params) => api.get('/milk-sales/balance-report', { params }).then(res => res.data).catch(handleError),
};

// UNION SALES SLIP APIs
export const unionSalesSlipAPI = {
  getAll:  (params) => api.get('/union-sales-slips', { params }).then(res => res.data).catch(handleError),
  getById: (id)     => api.get(`/union-sales-slips/${id}`).then(res => res.data).catch(handleError),
  create:  (data)   => api.post('/union-sales-slips', data).then(res => res.data).catch(handleError),
  update:  (id, data) => api.put(`/union-sales-slips/${id}`, data).then(res => res.data).catch(handleError),
  delete:  (id)     => api.delete(`/union-sales-slips/${id}`).then(res => res.data).catch(handleError),
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
  create: (data) => api.post('/leaves', data).then(res => res.data).catch(handleError),
  apply: (data) => api.post('/leaves', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/leaves/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/leaves/${id}`).then(res => res.data).catch(handleError),
  approve: (id, data) => api.patch(`/leaves/${id}/approve`, data).then(res => res.data).catch(handleError),
  reject: (id, data) => api.patch(`/leaves/${id}/reject`, data).then(res => res.data).catch(handleError),
  getSummary: (employeeId, params) => api.get(`/leaves/${employeeId}/summary`, { params }).then(res => res.data).catch(handleError)
};

// LOAN APIs (Employee Loans / Advances)
export const loanAPI = {
  getAll: (params) => api.get('/loans', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/loans/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/loans', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/loans/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/loans/${id}`).then(res => res.data).catch(handleError),
  makePayment: (id, amount) => api.post(`/loans/${id}/payment`, { amount }).then(res => res.data).catch(handleError)
};

// COMPANY APIs
export const companyAPI = {
  getAll: (params) => api.get('/companies', { params }).then(res => res.data).catch(handleError),
  // Use publicApi for getPublic - no auth token needed (for login page)
  getPublic: () => publicApi.get('/companies/public').then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/companies/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/companies', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/companies/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/companies/${id}`).then(res => res.data).catch(handleError),
  getStats: () => api.get('/companies/stats').then(res => res.data).catch(handleError)
};

// USER MANAGEMENT APIs (Company level user management)
export const userManagementAPI = {
  getAll: (params) => api.get('/user-management', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/user-management/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/user-management', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/user-management/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/user-management/${id}`).then(res => res.data).catch(handleError),
  resetPassword: (id, newPassword) => api.patch(`/user-management/${id}/reset-password`, { newPassword }).then(res => res.data).catch(handleError),
  getModules: () => api.get('/user-management/modules').then(res => res.data).catch(handleError),
  getDesignations: () => api.get('/user-management/designations').then(res => res.data).catch(handleError),
  getUserTypes: () => api.get('/user-management/user-types').then(res => res.data).catch(handleError)
};

// \DUCER LOAN APIs
export const producerLoanAPI = {
  getAll: (params) => api.get('/producer-loans', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/producer-loans/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/producer-loans', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/producer-loans/${id}`, data).then(res => res.data).catch(handleError),
  cancel: (id, reason) => api.post(`/producer-loans/${id}/cancel`, { reason }).then(res => res.data).catch(handleError),
  getFarmerLoans: (farmerId, params) => api.get(`/producer-loans/farmer/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  recordEMI: (id, data) => api.post(`/producer-loans/${id}/emi`, data).then(res => res.data).catch(handleError),
  getStats: (params) => api.get('/producer-loans/stats', { params }).then(res => res.data).catch(handleError)
};

// PRODUCER RECEIPT APIs
export const producerReceiptAPI = {
  getAll: (params) => api.get('/producer-receipts', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/producer-receipts/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/producer-receipts', data).then(res => res.data).catch(handleError),
  cancel: (id, reason) => api.post(`/producer-receipts/${id}/cancel`, { reason }).then(res => res.data).catch(handleError),
  getFarmerReceipts: (farmerId, params) => api.get(`/producer-receipts/farmer/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  getPrintData: (id) => api.get(`/producer-receipts/${id}/print`).then(res => res.data).catch(handleError)
};

// INDIVIDUAL DEDUCTION / EARNING APIs
export const individualDeductionEarningAPI = {
  getAll: (params) => api.get('/individual-transactions', { params }).then(res => res.data).catch(handleError),
};

// FARMER LEDGER APIs
export const farmerLedgerAPI = {
  getLedger: (farmerId, params) => api.get(`/farmer-payments/farmer/${farmerId}/ledger`, { params }).then(res => res.data).catch(handleError),
  getSummary: (farmerId) => api.get(`/farmer-payments/farmer/${farmerId}/summary`).then(res => res.data).catch(handleError),
  checkWelfare: (farmerId, date, fromDate, toDate) => api.get(`/farmer-payments/farmer/${farmerId}/welfare-check`, { params: { date, fromDate, toDate } }).then(res => res.data).catch(handleError),
  getOutstandingByType: (farmerId) => api.get(`/farmer-payments/farmer/${farmerId}/outstanding-by-type`).then(res => res.data).catch(handleError)
};

// PRODUCER REGISTER APIs (Detailed Ledger)
export const producerRegisterAPI = {
  getRegister: (farmerId, params) => api.get(`/producer-register/${farmerId}`, { params }).then(res => res.data).catch(handleError),
  saveRegister: (farmerId, data) => api.post(`/producer-register/${farmerId}`, data).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/producer-register/summary', { params }).then(res => res.data).catch(handleError)
};

// BANK TRANSFER APIs
export const bankTransferAPI = {
  retrieve: (data) => api.post('/bank-transfers/retrieve', data).then(res => res.data).catch(handleError),
  apply: (data) => api.post('/bank-transfers/apply', data).then(res => res.data).catch(handleError),
  getAll: (params) => api.get('/bank-transfers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/bank-transfers/${id}`).then(res => res.data).catch(handleError),
  cancel: (id) => api.post(`/bank-transfers/${id}/cancel`).then(res => res.data).catch(handleError),
  complete: (id) => api.post(`/bank-transfers/${id}/complete`).then(res => res.data).catch(handleError),
  getCollectionCenters: () => api.get('/bank-transfers/collection-centers').then(res => res.data).catch(handleError),
  getBanks: () => api.get('/bank-transfers/banks').then(res => res.data).catch(handleError)
};

// BUSINESS ITEM APIs
export const businessItemAPI = {
  getAll: (params) => api.get('/business-inventory/items', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-inventory/items/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-inventory/items', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-inventory/items/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-inventory/items/${id}`).then(res => res.data).catch(handleError),
  updateOpeningBalance: (id, data) => api.patch(`/business-inventory/items/${id}/opening-balance`, data).then(res => res.data).catch(handleError),
  updatePrices: (id, data) => api.patch(`/business-inventory/items/${id}/prices`, data).then(res => res.data).catch(handleError)
};

// BUSINESS STOCK APIs
export const businessStockAPI = {
  stockIn: (data) => api.post('/business-inventory/stock/in', data).then(res => res.data).catch(handleError),
  stockOut: (data) => api.post('/business-inventory/stock/out', data).then(res => res.data).catch(handleError),
  getTransactions: (params) => api.get('/business-inventory/stock/transactions', { params }).then(res => res.data).catch(handleError),
  getBalance: (params) => api.get('/business-inventory/stock/balance', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-inventory/stock/transactions/${id}`).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-inventory/stock/transactions/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-inventory/stock/transactions/${id}`).then(res => res.data).catch(handleError)
};

// BUSINESS SALES APIs (Vyapar-style billing for Private Firm)
export const businessSalesAPI = {
  getAll: (params) => api.get('/business-sales', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-sales/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-sales', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-sales/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-sales/${id}`).then(res => res.data).catch(handleError),
  getPartyHistory: (partyId) => api.get(`/business-sales/party/${partyId}/history`).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/business-sales/summary', { params }).then(res => res.data).catch(handleError)
};

// PURCHASE RETURN APIs (Debit Note - for Private Firm)
export const purchaseReturnAPI = {
  getAll: (params) => api.get('/purchase-returns', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/purchase-returns/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/purchase-returns', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/purchase-returns/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/purchase-returns/${id}`).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/purchase-returns/summary', { params }).then(res => res.data).catch(handleError)
};

// SALES RETURN APIs (Credit Note - for Private Firm)
export const salesReturnAPI = {
  getAll: (params) => api.get('/sales-returns', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/sales-returns/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/sales-returns', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/sales-returns/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/sales-returns/${id}`).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/sales-returns/summary', { params }).then(res => res.data).catch(handleError)
};

// DAIRY PURCHASE RETURN APIs (Debit Note - for Dairy Cooperative)
export const dairyPurchaseReturnAPI = {
  getAll: (params) => api.get('/dairy-purchase-returns', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/dairy-purchase-returns/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/dairy-purchase-returns', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/dairy-purchase-returns/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/dairy-purchase-returns/${id}`).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/dairy-purchase-returns/summary', { params }).then(res => res.data).catch(handleError)
};

// DAIRY SALES RETURN APIs (Credit Note - for Dairy Cooperative)
export const dairySalesReturnAPI = {
  getAll: (params) => api.get('/dairy-sales-returns', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/dairy-sales-returns/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/dairy-sales-returns', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/dairy-sales-returns/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/dairy-sales-returns/${id}`).then(res => res.data).catch(handleError),
  getSummary: (params) => api.get('/dairy-sales-returns/summary', { params }).then(res => res.data).catch(handleError)
};

// BUSINESS LEDGER APIs (Separate ledgers for Private Firm)
export const businessLedgerAPI = {
  getAll: (params) => api.get('/business-accounting/ledgers', { params }).then(res => res.data).catch(handleError),
  getById: (id, params) => api.get(`/business-accounting/ledgers/${id}`, { params }).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-accounting/ledgers', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-accounting/ledgers/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-accounting/ledgers/${id}`).then(res => res.data).catch(handleError)
};

// BUSINESS VOUCHER APIs (Separate vouchers for Private Firm)
export const businessVoucherAPI = {
  getAll: (params) => api.get('/business-accounting/vouchers', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-accounting/vouchers/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-accounting/vouchers', data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-accounting/vouchers/${id}`).then(res => res.data).catch(handleError),
  createIncome: (data) => api.post('/business-accounting/income-voucher', data).then(res => res.data).catch(handleError),
  createExpense: (data) => api.post('/business-accounting/expense-voucher', data).then(res => res.data).catch(handleError),
  createJournal: (data) => api.post('/business-accounting/journal-voucher', data).then(res => res.data).catch(handleError),
  createReceipt: (data) => api.post('/business-accounting/receipt-voucher', data).then(res => res.data).catch(handleError),
  createPayment: (data) => api.post('/business-accounting/payment-voucher', data).then(res => res.data).catch(handleError),
  createContra: (data) => api.post('/business-accounting/contra-voucher', data).then(res => res.data).catch(handleError),
  initSystemLedgers: () => api.post('/business-accounting/init-system-ledgers').then(res => res.data).catch(handleError),
  saveOpeningBalance: (data) => api.post('/business-accounting/opening-balance', data).then(res => res.data).catch(handleError)
};

// BUSINESS PROMOTION APIs (Vyapar-style for Private Firm)
export const businessPromotionAPI = {
  getAll: (params) => api.get('/business-promotions', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/business-promotions/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/business-promotions', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/business-promotions/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/business-promotions/${id}`).then(res => res.data).catch(handleError),
  validateCoupon: (data) => api.post('/business-promotions/validate-coupon', data).then(res => res.data).catch(handleError),
  redeem: (data) => api.post('/business-promotions/redeem', data).then(res => res.data).catch(handleError),
  getAnalytics: () => api.get('/business-promotions/analytics').then(res => res.data).catch(handleError),
  getRedemptions: (id) => api.get(`/business-promotions/${id}/redemptions`).then(res => res.data).catch(handleError),
  // Template APIs
  createTemplate: (data) => api.post('/business-promotions/templates', data).then(res => res.data).catch(handleError),
  getAllTemplates: (params) => api.get('/business-promotions/templates', { params }).then(res => res.data).catch(handleError),
  getTemplateById: (id) => api.get(`/business-promotions/templates/${id}`).then(res => res.data).catch(handleError),
  updateTemplate: (id, data) => api.put(`/business-promotions/templates/${id}`, data).then(res => res.data).catch(handleError),
  deleteTemplate: (id) => api.delete(`/business-promotions/templates/${id}`).then(res => res.data).catch(handleError),
  previewTemplate: (id, data) => api.post(`/business-promotions/templates/${id}/preview`, data).then(res => res.data).catch(handleError)
};

// RATE CHART APIs (Daily Collections - Dairy Cooperative)
export const rateChartAPI = {
  // Manual Entry
  getManualEntries: ()        => api.get('/rate-charts/manual-entries').then(r => r.data).catch(handleError),
  createManualEntry: (data)   => api.post('/rate-charts/manual-entries', data).then(r => r.data).catch(handleError),
  updateManualEntry: (id, d)  => api.put(`/rate-charts/manual-entries/${id}`, d).then(r => r.data).catch(handleError),
  deleteManualEntry: (id)     => api.delete(`/rate-charts/manual-entries/${id}`).then(r => r.data).catch(handleError),
  // Apply Formula
  getFormulas: ()             => api.get('/rate-charts/formulas').then(r => r.data).catch(handleError),
  createFormula: (data)       => api.post('/rate-charts/formulas', data).then(r => r.data).catch(handleError),
  updateFormula: (id, d)      => api.put(`/rate-charts/formulas/${id}`, d).then(r => r.data).catch(handleError),
  deleteFormula: (id)         => api.delete(`/rate-charts/formulas/${id}`).then(r => r.data).catch(handleError),
  // Low Chart
  getLowCharts: ()            => api.get('/rate-charts/low-charts').then(r => r.data).catch(handleError),
  createLowChart: (data)      => api.post('/rate-charts/low-charts', data).then(r => r.data).catch(handleError),
  updateLowChart: (id, d)     => api.put(`/rate-charts/low-charts/${id}`, d).then(r => r.data).catch(handleError),
  deleteLowChart: (id)        => api.delete(`/rate-charts/low-charts/${id}`).then(r => r.data).catch(handleError),
  // Gold / Less / Existing Chart
  getGoldLessCharts: ()       => api.get('/rate-charts/gold-less-charts').then(r => r.data).catch(handleError),
  createGoldLessChart: (data) => api.post('/rate-charts/gold-less-charts', data).then(r => r.data).catch(handleError),
  updateGoldLessChart: (id,d) => api.put(`/rate-charts/gold-less-charts/${id}`, d).then(r => r.data).catch(handleError),
  deleteGoldLessChart: (id)   => api.delete(`/rate-charts/gold-less-charts/${id}`).then(r => r.data).catch(handleError),
  // Slab Rate
  getSlabRates: ()            => api.get('/rate-charts/slab-rates').then(r => r.data).catch(handleError),
  createSlabRate: (data)      => api.post('/rate-charts/slab-rates', data).then(r => r.data).catch(handleError),
  updateSlabRate: (id, d)     => api.put(`/rate-charts/slab-rates/${id}`, d).then(r => r.data).catch(handleError),
  deleteSlabRate: (id)        => api.delete(`/rate-charts/slab-rates/${id}`).then(r => r.data).catch(handleError)
};

// AGENT APIs (Dairy Cooperative - Collection Agents)
export const agentAPI = {
  getAll: (params) => api.get('/agents', { params }).then(res => res.data).catch(handleError),
  getAllActive: () => api.get('/agents', { params: { all: 'true' } }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/agents/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/agents', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/agents/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/agents/${id}`).then(res => res.data).catch(handleError),
  toggleStatus: (id) => api.patch(`/agents/${id}/status`).then(res => res.data).catch(handleError)
};

// ─── MILK PURCHASE SETTINGS APIs (Daily Collections - Dairy Cooperative) ─────
export const salesmanAPI = {
  getAll: (params) => api.get('/salesman', { params }).then(res => res.data).catch(handleError),
  search: (query) => api.get('/salesman/search', { params: { query } }).then(res => res.data).catch(handleError),
  create: (data) => api.post('/salesman', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/salesman/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/salesman/${id}`).then(res => res.data).catch(handleError)
};

export const milkPurchaseSettingsAPI = {
  // GET full settings (auto-creates with defaults if first time)
  getSettings    : ()      => api.get('/milk-purchase-settings').then(r => r.data).catch(handleError),

  // GET lightweight summary (quantityUnit, combo, printSize, machines) – used in MilkPurchase screen
  getSummary     : ()      => api.get('/milk-purchase-settings/summary').then(r => r.data).catch(handleError),

  // PUT upsert – send full or partial settings object
  saveSettings   : (data)  => api.put('/milk-purchase-settings', data).then(r => r.data).catch(handleError),

  // DELETE /reset – restore all settings to factory defaults
  resetSettings  : ()      => api.delete('/milk-purchase-settings/reset').then(r => r.data).catch(handleError),

  // PATCH /machines/:key – toggle a single device  { enabled: true|false }
  toggleMachine  : (key, enabled) =>
    api.patch(`/milk-purchase-settings/machines/${key}`, { enabled }).then(r => r.data).catch(handleError),
};

// MILK SALES RATE APIs
export const milkSalesRateAPI = {
  // Get all rates with optional pagination/search/filter
  getAll: (params = {}) =>
    api.get('/milk-sales-rates', { params }).then(res => res.data).catch(handleError),

  // Get latest active rate for a party + salesItem (used during billing)
  getLatest: (partyId, salesItem, date) => {
    const params = { salesItem, date };
    if (partyId) params.partyId = partyId;
    return api.get('/milk-sales-rates/latest', { params })
      .then(res => res.data).catch(handleError);
  },

  // Get full rate history for a specific party
  getHistory: (partyId) =>
    api.get(`/milk-sales-rates/history/${partyId}`).then(res => res.data).catch(handleError),

  // Create new rate entry
  create: (data) =>
    api.post('/milk-sales-rates', data).then(res => res.data).catch(handleError),

  // Update existing rate entry
  update: (id, data) =>
    api.put(`/milk-sales-rates/${id}`, data).then(res => res.data).catch(handleError),

  // Delete rate entry
  delete: (id) =>
    api.delete(`/milk-sales-rates/${id}`).then(res => res.data).catch(handleError),
};

// ─── SHIFT INCENTIVE APIs ─────────────────────────────────────────────────────
export const shiftIncentiveAPI = {
  // GET all (paginated + filters)
  getAll: (params = {}) =>
    api.get('/shift-incentives', { params }).then(r => r.data).catch(handleError),

  // GET single record by ID
  getById: (id) =>
    api.get(`/shift-incentives/${id}`).then(r => r.data).catch(handleError),

  // GET active incentives for billing integration with milk purchase
  getActive: (params = {}) =>
    api.get('/shift-incentives/active', { params }).then(r => r.data).catch(handleError),

  // POST create new
  create: (data) =>
    api.post('/shift-incentives', data).then(r => r.data).catch(handleError),

  // PUT update
  update: (id, data) =>
    api.put(`/shift-incentives/${id}`, data).then(r => r.data).catch(handleError),

  // PATCH toggle active / inactive
  toggleStatus: (id) =>
    api.patch(`/shift-incentives/${id}/status`).then(r => r.data).catch(handleError),

  // DELETE soft-delete (sets inactive)
  delete: (id) =>
    api.delete(`/shift-incentives/${id}`).then(r => r.data).catch(handleError),
};

export const timeIncentiveAPI = {
  getAll:       (params = {}) => api.get('/time-incentives', { params }).then(r => r.data).catch(handleError),
  getActive:    (params = {}) => api.get('/time-incentives/active', { params }).then(r => r.data).catch(handleError),
  getById:      (id)          => api.get(`/time-incentives/${id}`).then(r => r.data).catch(handleError),
  create:       (data)        => api.post('/time-incentives', data).then(r => r.data).catch(handleError),
  update:       (id, data)    => api.put(`/time-incentives/${id}`, data).then(r => r.data).catch(handleError),
  toggleStatus: (id)          => api.patch(`/time-incentives/${id}/status`).then(r => r.data).catch(handleError),
  delete:       (id)          => api.delete(`/time-incentives/${id}`).then(r => r.data).catch(handleError),
};

// ─── EARNING / DEDUCTION MASTER APIs ─────────────────────────────────────────
export const earningDeductionAPI = {
  getAll:       (params = {}) => api.get('/earning-deductions', { params }).then(r => r.data).catch(handleError),
  getActive:    ()            => api.get('/earning-deductions/active').then(r => r.data).catch(handleError),
  getById:      (id)          => api.get(`/earning-deductions/${id}`).then(r => r.data).catch(handleError),
  create:       (data)        => api.post('/earning-deductions', data).then(r => r.data).catch(handleError),
  update:       (id, data)    => api.put(`/earning-deductions/${id}`, data).then(r => r.data).catch(handleError),
  toggleStatus: (id)          => api.patch(`/earning-deductions/${id}/status`).then(r => r.data).catch(handleError),
  delete:             (id)     => api.delete(`/earning-deductions/${id}`).then(r => r.data).catch(handleError),
  bulkUpdateSettings: (items)  => api.put('/earning-deductions/settings/bulk', { items }).then(r => r.data).catch(handleError),
};

export const periodicalRuleAPI = {
  getAll:       (params = {}) => api.get('/periodical-rules', { params }).then(r => r.data).catch(handleError),
  create:       (data)        => api.post('/periodical-rules', data).then(r => r.data).catch(handleError),
  toggleStatus: (id)          => api.patch(`/periodical-rules/${id}/status`).then(r => r.data).catch(handleError),
  delete:       (id)          => api.delete(`/periodical-rules/${id}`).then(r => r.data).catch(handleError),
};

export const historicalRuleAPI = {
  getAll: (params = {}) => api.get('/historical-rules', { params }).then(r => r.data).catch(handleError),
  create: (data)        => api.post('/historical-rules', data).then(r => r.data).catch(handleError),
  delete: (id)          => api.delete(`/historical-rules/${id}`).then(r => r.data).catch(handleError),
};

export const individualTransactionAPI = {
  getAll:          (params = {}) => api.get('/individual-transactions', { params }).then(r => r.data).catch(handleError),
  getById:         (id)          => api.get(`/individual-transactions/${id}`).then(r => r.data).catch(handleError),
  create:          (data)        => api.post('/individual-transactions', data).then(r => r.data).catch(handleError),
  update:          (id, data)    => api.put(`/individual-transactions/${id}`, data).then(r => r.data).catch(handleError),
  delete:          (id)          => api.delete(`/individual-transactions/${id}`).then(r => r.data).catch(handleError),
  lookupProducer:  (code)        => api.get(`/individual-transactions/lookup/${code}`).then(r => r.data).catch(handleError),
};

// ── Thermal Printer API ───────────────────────────────────────────────────────
// No auth header needed — hits /api/print/* which has no protect middleware
const printApi = axios.create({
  baseURL: 'http://localhost:5000/api/print',
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

export const thermalPrintAPI = {
  milkReceipt:      (data) => printApi.post('/milk-receipt',       data),
  milkSalesReceipt: (data) => printApi.post('/milk-sales-receipt', data),
  status:           ()     => printApi.get('/status')
};

// ── Milk Analyzer API ─────────────────────────────────────────────────────────
export const milkAnalyzerAPI = {
  save:    (data)   => api.post('/milk-analyzer', data).then(r => r.data).catch(handleError),
  getAll:  (params) => api.get('/milk-analyzer', { params }).then(r => r.data).catch(handleError),
  delete:  (id)     => api.delete(`/milk-analyzer/${id}`).then(r => r.data).catch(handleError)
};

// ── Machine Config API (Analyzer device settings + start/stop) ────────────────
export const machineConfigAPI = {
  getConfig:  ()     => api.get('/machine-config').then(r => r.data).catch(handleError),
  save:       (data) => api.post('/machine-config', data).then(r => r.data).catch(handleError),
  listPorts:  ()     => api.get('/machine-config/ports').then(r => r.data).catch(handleError),
  getStatus:  ()     => api.get('/machine-config/status').then(r => r.data).catch(handleError),
  start:      (data) => api.post('/machine-config/start', data || {}).then(r => r.data).catch(handleError),
  stop:       ()     => api.post('/machine-config/stop').then(r => r.data).catch(handleError),
};

// ── Society Info & Document Management API ────────────────────────────────────
export const societyInfoAPI = {
  get:            ()           => api.get('/society-info').then(r => r.data).catch(handleError),
  upsert:         (data)       => api.put('/society-info', data).then(r => r.data).catch(handleError),
  upsertDocument: (key, data)  => api.put(`/society-info/documents/${key}`, data).then(r => r.data).catch(handleError),
  deleteDocument: (key)        => api.delete(`/society-info/documents/${key}`).then(r => r.data).catch(handleError),
};

// ── Milk Bill Report API ──────────────────────────────────────────────────────
export const milkBillAPI = {
  get: (farmerId, params) =>
    api.get(`/milk-bill/${farmerId}`, { params }).then(r => r.data).catch(handleError),
};

// ── Payment Register API ───────────────────────────────────────────────────────
export const paymentRegisterAPI = {
  getAll:               (params = {}) => api.get('/payment-register', { params }).then(r => r.data).catch(handleError),
  getById:              (id)          => api.get(`/payment-register/${id}`).then(r => r.data).catch(handleError),
  getProducersForPeriod:(params)      => api.get('/payment-register/producers-for-period', { params }).then(r => r.data).catch(handleError),
  getLatestProducers:   ()            => api.get('/payment-register/producers-latest').then(r => r.data).catch(handleError),
  generate:             (data)        => api.post('/payment-register/generate', data).then(r => r.data).catch(handleError),
  generateProducers:    (data)        => api.post('/payment-register/generate-producers', data).then(r => r.data).catch(handleError),
  create:               (data)        => api.post('/payment-register', data).then(r => r.data).catch(handleError),
  update:               (id, data)    => api.put(`/payment-register/${id}`, data).then(r => r.data).catch(handleError),
  delete:               (id)          => api.delete(`/payment-register/${id}`).then(r => r.data).catch(handleError),
  applyEntry:           (registerId, entryId, data) =>
    api.post(`/payment-register/${registerId}/entries/${entryId}/apply`, data).then(r => r.data).catch(handleError),
};

// ── Dairy Settings API (payment days, account start date, opening balances) ────
export const dairySettingsAPI = {
  get:    ()     => api.get('/dairy-settings').then(r => r.data).catch(handleError),
  update: (data) => api.put('/dairy-settings', data).then(r => r.data).catch(handleError),
};

// ── Financial Year API ─────────────────────────────────────────────────────────
export const financialYearAPI = {
  getAll:        ()       => api.get('/financial-years').then(r => r.data).catch(handleError),
  getActive:     ()       => api.get('/financial-years/active').then(r => r.data).catch(handleError),
  checkFrozen:   (date)   => api.get('/financial-years/check-frozen', { params: { date } }).then(r => r.data).catch(handleError),
  create:        (data)   => api.post('/financial-years', data).then(r => r.data).catch(handleError),
  update:        (id, data) => api.put(`/financial-years/${id}`, data).then(r => r.data).catch(handleError),
  close:         (id)     => api.post(`/financial-years/${id}/close`).then(r => r.data).catch(handleError),
  activate:      (id)     => api.post(`/financial-years/${id}/activate`).then(r => r.data).catch(handleError),
  toggleFreeze:  (id)     => api.post(`/financial-years/${id}/toggle-freeze`).then(r => r.data).catch(handleError),
  delete:        (id)     => api.delete(`/financial-years/${id}`).then(r => r.data).catch(handleError),
};

// ── Producer Payment API ───────────────────────────────────────────────────────
export const producerPaymentAPI = {
  getAll:             (params)   => api.get('/producer-payments', { params }).then(res => res.data).catch(handleError),
  create:             (data)     => api.post('/producer-payments', data).then(res => res.data).catch(handleError),
  getProducerBalance: (farmerId) => api.get(`/producer-payments/balance/${farmerId}`).then(res => res.data).catch(handleError),
  update:             (id, data) => api.put(`/producer-payments/${id}`, data).then(res => res.data).catch(handleError),
  cancel:             (id)       => api.post(`/producer-payments/${id}/cancel`).then(res => res.data).catch(handleError),
};

// ── Producer Opening API ───────────────────────────────────────────────────────
export const producerOpeningAPI = {
  getAll:          (params)   => api.get('/producer-openings', { params }).then(res => res.data).catch(handleError),
  create:          (data)     => api.post('/producer-openings', data).then(res => res.data).catch(handleError),
  update:          (id, data) => api.put(`/producer-openings/${id}`, data).then(res => res.data).catch(handleError),
  delete:          (id)       => api.delete(`/producer-openings/${id}`).then(res => res.data).catch(handleError),
  getByFarmer:     (farmerId) => api.get(`/producer-openings/farmer/${farmerId}`).then(res => res.data).catch(handleError),
};

// ── Cattle Feed Advance API ────────────────────────────────────────────────────
export const cattleFeedAdvanceAPI = {
  getFarmers: ()       => api.get('/cattle-feed-advance/farmers').then(r => r.data).catch(handleError),
  getLedger:  (params) => api.get('/cattle-feed-advance/ledger',  { params }).then(r => r.data).catch(handleError),
  getSummary: (params) => api.get('/cattle-feed-advance/summary', { params }).then(r => r.data).catch(handleError),
};

// ── Agricultural Statistics Report API ────────────────────────────────────────
export const agriStatsAPI = {
  getAll:  (params)   => api.get('/agri-stats', { params }).then(r => r.data).catch(handleError),
  getById: (id)       => api.get(`/agri-stats/${id}`).then(r => r.data).catch(handleError),
  create:  (data)     => api.post('/agri-stats', data).then(r => r.data).catch(handleError),
  update:  (id, data) => api.put(`/agri-stats/${id}`, data).then(r => r.data).catch(handleError),
  delete:  (id)       => api.delete(`/agri-stats/${id}`).then(r => r.data).catch(handleError),
};

// ── Crop Statement API ─────────────────────────────────────────────────────────
export const cropStatementAPI = {
  getAll:   (params)   => api.get('/crop-statements', { params }).then(r => r.data).catch(handleError),
  getById:  (id)       => api.get(`/crop-statements/${id}`).then(r => r.data).catch(handleError),
  create:   (data)     => api.post('/crop-statements', data).then(r => r.data).catch(handleError),
  update:   (id, data) => api.put(`/crop-statements/${id}`, data).then(r => r.data).catch(handleError),
  delete:   (id)       => api.delete(`/crop-statements/${id}`).then(r => r.data).catch(handleError),
};

export default api;
