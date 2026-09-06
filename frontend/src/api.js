import axios from 'axios';

// Vite proxy forwards /api to http://localhost:8000 in dev (vite.config.js)
// In production (GitHub Pages) falls back to same origin or env var
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Attach JWT if exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lrds_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize failures so the UI (and console) shows one clear, actionable
// message instead of cryptic axios/proxy errors.
// - Backend not running  -> no response, or a 5xx HTML page from the vite
//   preview proxy  => flag as backendDown with a "start the backend" message.
const IS_PAGES = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
export const BACKEND_DOWN_MESSAGE = IS_PAGES
  ? 'Live site is frontend-only (GitHub Pages). Backend runs locally — download the repo and run start_all.bat, or set VITE_API_URL to a hosted backend. Use Demo Login below to preview the UI.'
  : 'Backend unreachable — start it with start_backend.bat (http://127.0.0.1:8000) and retry';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.backendDown = true;
      error.message = BACKEND_DOWN_MESSAGE;
    } else if (typeof error.response.data === 'string') {
      // Non-JSON (proxy/static HTML error page). Only 5xx means backend down.
      if (error.response.status >= 500) {
        error.backendDown = true;
        error.message = BACKEND_DOWN_MESSAGE;
      } else {
        error.message = `Request failed (${error.response.status})`;
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// Helpers matching backend routes in backend/app/main.py
export const health = () => api.get('/health').then(r => r.data); // proxied as http://localhost:8000/health via vite /api ? use direct
export const uploadDocument = (file, language = 'hi', docType = 'register', onUploadProgress) => {
  const form = new FormData();
  form.append('file', file);
  form.append('language', language);
  form.append('doc_type', docType);
  return api.post('/v1/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // AI OCR on scanned PDFs can take a minute or more — don't time out early
    timeout: 300000,
    onUploadProgress,
  }).then(r => r.data);
};
export const listDocuments = (skip=0, limit=50, query='') => api.get('/v1/documents/', { params: { skip, limit, query } }).then(r=>r.data);
export const getDocument = (id) => api.get(`/v1/documents/${id}`).then(r=>r.data);
export const getDocumentSource = (id) => api.get(`/v1/documents/${id}/source`, { responseType: 'blob' }).then(r=>r.data);
export const downloadVerifiedDocument = (id) => api.get(`/v1/documents/${id}/download`, { responseType: 'blob' }).then(r=>r.data);
export const deleteDocument = (id) => api.delete(`/v1/documents/${id}`).then(r=>r.data);
export const clearAllDocuments = () => api.delete('/v1/documents/').then(r=>r.data);
export const getPendingVerifications = (limit=50) => api.get(`/v1/verification/pending?limit=${limit}`).then(r=>r.data);
export const verifyField = (fieldId, payload) => api.post(`/v1/verification/verify/${fieldId}`, payload).then(r=>r.data);
export const getAnalytics = () => api.get('/v1/analytics/stats').then(r=>r.data);
export const getDistrictProgress = () => api.get('/v1/analytics/district-progress').then(r=>r.data);
export const getConfidenceDistribution = () => api.get('/v1/analytics/confidence-distribution').then(r=>r.data);
export const getUploadsTrend = () => api.get('/v1/analytics/uploads-trend').then(r=>r.data);
export const getRecentActivity = (limit=10) => api.get(`/v1/analytics/recent-activity?limit=${limit}`).then(r=>r.data);
export const getUserActivity = (limit=50) => api.get(`/v1/analytics/user-activity?limit=${limit}`).then(r=>r.data);
export const getVerificationStats = () => api.get('/v1/verification/stats').then(r=>r.data);
export const getIntegrationsHealth = () => api.get('/v1/integrations/health').then(r=>r.data);
export const getCurrentUser = () => api.get('/v1/auth/me').then(r=>r.data);
export const updateCurrentUser = (full_name) => api.patch('/v1/auth/me', { full_name }).then(r=>r.data);
export const login = (email, password) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);
  return api.post('/v1/auth/login', params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(r=>r.data);
};
export const register = (email, password, full_name, role='citizen') => api.post('/v1/auth/register', { email, password, full_name, role }).then(r=>r.data);

// Integration & API Key helpers
export const listApiKeys = () => api.get('/v1/api-keys/').then(r => r.data);
export const createApiKey = (name) => api.post('/v1/api-keys/', { name }).then(r => r.data);
export const revokeApiKey = (keyId) => api.delete(`/v1/api-keys/${keyId}`).then(r => r.data);
export const syncLrms = (payload) => api.post('/v1/integrations/lrms', payload || {}).then(r => r.data);
export const syncDilmrp = (payload) => api.post('/v1/integrations/dilmrp', payload || {}).then(r => r.data);
export const getLrmsStatus = () => api.get('/v1/integrations/lrms/status').then(r => r.data);
export const getLrmsHistory = (limit=20) => api.get(`/v1/integrations/lrms/history?limit=${limit}`).then(r => r.data);
export const getGisParcel = (surveyNo) => api.get(`/v1/integrations/gis/parcel?survey_no=${encodeURIComponent(surveyNo)}`).then(r => r.data);
export const getGisParcels = (limit=50) => api.get(`/v1/integrations/gis/parcels?limit=${limit}`).then(r => r.data);
