import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { api } from '../api';
import { authGuard, clearAuthSession } from '../../guard/auth';

type Data = {
  sessionsRevoked: boolean;
  sessionType: string;
  loggedOutAt: string;
};

type LogoutSessionsResponse = {
  result: boolean;
  message: string | Data;
  error?: {
    message?: string;
  };
};

export async function logoutSessions(): Promise<void> {
  if (!authGuard()) {
    throw new Error('Please sign in before signing out.');
  }

  let res: AxiosResponse<unknown>;

  try {
    res = await api.post<unknown>('/v1/auth/sessions/logout', {}, { validateStatus: () => true });
  } catch (error) {
    if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    }

    throw new Error('Unable to connect. Please check your connection and try again.');
  }

  const response = res.data as Partial<LogoutSessionsResponse> | null;
  const isSuccess = res.status >= 200 && res.status < 300 && response?.result === true;

  if (!isSuccess) {
    const detail =
      typeof response?.error?.message === 'string' ? response.error.message.trim() : '';
    const message = typeof response?.message === 'string' ? response.message.trim() : '';

    throw new Error(detail || message || 'Unable to sign out. Please try again.');
  }

  clearAuthSession();
}
