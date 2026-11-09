import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { api } from '../api';

export interface Member {
  id: number;
  username: string;
  email: string;
  m_phone?: string | null;
  m_image_url?: string;
  m_image_path?: string;
  m_name?: string;
  m_lastname?: string;
  isKYC?: number;
  ib?: number;
  ibType?: number;
  mt5_category?: number;
  member_roles?: unknown[];
}

export interface LoginData {
  require2FA: false;
  member: Member;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionUid: string;
}

export interface Login2FAData {
  require2FA: true;
  preAuthToken: string;
}

export interface LoginResponse {
  result: boolean | string;
  message: string;
  data?: LoginData | Login2FAData | null;
  code?: number;
  error?: {
    code?: string;
    message?: string;
  };
}

export async function login(body: {
  usernameOrEmail: string;
  password: string;
}): Promise<LoginResponse> {
  let res: AxiosResponse<unknown>;

  try {
    res = await api.post<unknown>('/v1/auth/login', body, {
      validateStatus: () => true,
    });
  } catch (error) {
    if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    }

    throw new Error('Unable to connect. Please check your connection and try again.');
  }

  const response = res.data as Partial<LoginResponse> | null;

  if (res.status < 200 || res.status >= 300 || response?.result === false) {
    const detail =
      typeof response?.error?.message === 'string' ? response.error.message.trim() : '';
    const message = typeof response?.message === 'string' ? response.message.trim() : '';
    throw new Error(
      detail || message || `Unable to sign in (HTTP ${res.status}). Please try again.`,
    );
  }

  if (
    !response ||
    (typeof response.result !== 'boolean' && typeof response.result !== 'string') ||
    typeof response.message !== 'string' ||
    (response.code !== undefined && typeof response.code !== 'number')
  ) {
    throw new Error('The server returned an invalid response. Please try again.');
  }

  return response as LoginResponse;
}
