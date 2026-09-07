import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

let accessToken = localStorage.getItem('lms_access') || '';
let refreshing = null;

export function setAccessToken(token) {
  accessToken = token || '';
  if (token) localStorage.setItem('lms_access', token);
  else localStorage.removeItem('lms_access');
}

export function getAccessToken() {
  return accessToken;
}

function skipRefresh(url = '') {
  return /\/auth\/(login|register|refresh|forgot-password|reset-password)$/.test(url);
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const data = error.response?.data;
    if (data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await data.text());
      } catch {
        /* leave blob */
      }
    }
    if (error.response?.status === 401 && !original._retry && !skipRefresh(original.url || '')) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios.post('/api/v1/auth/refresh', {}, { withCredentials: true }).finally(() => {
            refreshing = null;
          });
        }
        const { data } = await refreshing;
        setAccessToken(data.accessToken);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken('');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
