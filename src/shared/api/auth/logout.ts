import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { authGuard, clearAuthSession } from '../../guard/auth';
import { api } from '../api';

interface LogoutResponse {
  result: boolean | string;
  message: string;
  error?: {
    message?: string;
  };
}

export async function logout(): Promise<void> {
  if (!authGuard()) {
    throw new Error('Please sign in before signing out.');
  }

  let res: AxiosResponse<unknown>;

  try {
    res = await api.post<unknown>(
      '/v1/auth/logout',
      { forgetDevice: false },
      { validateStatus: () => true },
    );
  } catch (error) {
    if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    }

    throw new Error('Unable to connect. Please check your connection and try again.');
  }

  const response = res.data as Partial<LogoutResponse> | null;
  const isSuccess =
    res.status >= 200 &&
    res.status < 300 &&
    (response?.result === true);

  if (!isSuccess) {
    const detail =
      typeof response?.error?.message === 'string' ? response.error.message.trim() : '';
    const message = typeof response?.message === 'string' ? response.message.trim() : '';

    throw new Error(detail || message || 'Unable to sign out. Please try again.');
  }

  clearAuthSession();
}
