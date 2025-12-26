import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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
  search: (query) => {
    // Validate query parameter - must be non-empty string
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Promise.reject({ message: 'Search query cannot be empty' });
    }
    return api.get('/farmers/search', { params: { query: query.trim() } }).then(res => res.data).catch(handleError);
  }
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

// ITEM APIs
export const itemAPI = {
  getAll: (params) => api.get('/items', { params }).then(res => res.data).catch(handleError),
  getById: (id) => api.get(`/items/${id}`).then(res => res.data).catch(handleError),
  create: (data) => api.post('/items', data).then(res => res.data).catch(handleError),
  update: (id, data) => api.put(`/items/${id}`, data).then(res => res.data).catch(handleError),
  delete: (id) => api.delete(`/items/${id}`).then(res => res.data).catch(handleError)
};

// STOCK APIs
export const stockAPI = {
  stockIn: (data) => api.post('/stock/in', data).then(res => res.data).catch(handleError),
  stockOut: (data) => api.post('/stock/out', data).then(res => res.data).catch(handleError),
  getTransactions: (params) => api.get('/stock/transactions', { params }).then(res => res.data).catch(handleError),
  getBalance: (params) => api.get('/stock/balance', { params }).then(res => res.data).catch(handleError)
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
  subsidy: (params) => api.get('/reports/subsidy', { params }).then(res => res.data).catch(handleError)
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

export default api;
