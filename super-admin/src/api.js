import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('sa_token');
  if (token) {
    // Use .set() for Axios v1.x AxiosHeaders compatibility
    cfg.headers.set('Authorization', `Bearer ${token}`);
  }
  return cfg;
}, err => Promise.reject(err));

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sa_token');
      localStorage.removeItem('sa_user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data).then(r => r.data)
};

export const companyAPI = {
  getAll:   (p)        => api.get('/companies', { params: p }).then(r => r.data),
  create:   (data)     => api.post('/companies', data).then(r => r.data),
  update:   (id, data) => api.put(`/companies/${id}`, data).then(r => r.data),
  delete:   (id)       => api.delete(`/companies/${id}`).then(r => r.data)
};

export const milmaChartAdminAPI = {
  // Upload Excel for a company (multipart/form-data)
  upload: (formData) => api.post('/milma-charts/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data),
  // List chart masters for a company
  getMasters: (companyId) => api.get(`/milma-charts/admin/${companyId}/masters`).then(r => r.data),
  // Get detail rows for a specific chart version (paginated)
  getDetail: (companyId, chartId, page = 1, limit = 100) =>
    api.get(`/milma-charts/admin/${companyId}/detail`, { params: { chartId, page, limit } }).then(r => r.data),
  // Delete all charts for a company
  deleteAll: (companyId) => api.delete(`/milma-charts/admin/${companyId}`).then(r => r.data),
};
