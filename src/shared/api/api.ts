import axios from 'axios';
import { environment } from '../../environments/environment';
import { getAuthHeaders } from '../guard/auth';
import { getDeviceSessionUid } from '../services/deviceSession';

export const baseUrl = environment.apiBaseUrl;

const deviceSessionPaths = new Set([
  '/v1/auth/login',
  '/v1/auth/2fa/verify',
  '/v1/auth/refresh',
  '/v1/member/register',
]);

export const api = axios.create({
  baseURL: baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  responseType: 'json',
  transitional: {
    silentJSONParsing: false,
  },
});

api.interceptors.request.use((config) => {
  const requestUrl = new URL(api.getUri(config), window.location.href);
  const apiUrl = new URL(baseUrl, window.location.href);
  if (requestUrl.origin !== apiUrl.origin) {
    return config;
  }

  const headers = getAuthHeaders();
  if (headers) {
    config.headers.set(headers);
  } else if (
    config.method?.toLowerCase() === 'post' &&
    deviceSessionPaths.has(requestUrl.pathname.replace(/\/+$/, '')) &&
    !config.headers.has('x-user-id')
  ) {
    const sessionUid = getDeviceSessionUid();
    if (sessionUid) {
      config.headers.set('x-user-id', sessionUid);
    }
  }

  return config;
});
