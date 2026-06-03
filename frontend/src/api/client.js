import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('fems_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.response?.data?.message || 'Something went wrong';
    if (err.response?.status === 401) {
      // Clear stored credentials without a page reload.
      // AuthContext listens for this event and clears React state,
      // then ProtectedRoute redirects to /login via React Router.
      localStorage.removeItem('fems_token');
      localStorage.removeItem('fems_user');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject({ ...err, message: msg });
  }
);

export default client;
