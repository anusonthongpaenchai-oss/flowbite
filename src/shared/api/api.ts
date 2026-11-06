import axios from 'axios';
import { environment } from '../../environments/environment';
import { getAuthHeaders } from '../guard/auth';

export const baseUrl = environment.apiBaseUrl;

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
  const headers = getAuthHeaders();

  if (headers) {
    const requestUrl = new URL(api.getUri(config), window.location.href);
    const apiUrl = new URL(baseUrl, window.location.href);

    if (requestUrl.origin === apiUrl.origin) {
      config.headers.set(headers);
    }
  }

  return config;
});
