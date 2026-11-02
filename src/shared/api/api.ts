import axios from 'axios';
import { environment } from '../../environments/environment';

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
