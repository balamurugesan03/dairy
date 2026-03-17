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
