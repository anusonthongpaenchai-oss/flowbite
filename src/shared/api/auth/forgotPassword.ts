import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { api } from '../api';

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  result: boolean;
  message: string;
  data: string;
};

type ForgotPasswordPayload = Partial<ForgotPasswordResponse> & {
  error?: { message?: string };
};

export async function forgotPassword(body: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  let res: AxiosResponse<unknown>;

  try {
    res = await api.post<unknown>('/v1/auth/forgot-password', body, {
      validateStatus: () => true,
    });
  } catch (error) {
    if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    }

    throw new Error('Unable to connect. Please check your connection and try again.');
  }

  const response = res.data as ForgotPasswordPayload | null;

  if (res.status < 200 || res.status >= 300 || response?.result === false) {
    const detail =
      typeof response?.error?.message === 'string' ? response.error.message.trim() : '';
    const message = typeof response?.message === 'string' ? response.message.trim() : '';

    throw new Error(
      detail ||
        message ||
        `Unable to request a password reset (HTTP ${res.status}). Please try again.`,
    );
  }

  if (
    !response ||
    response.result !== true ||
    typeof response.message !== 'string' ||
    typeof response.data !== 'string'
  ) {
    throw new Error('The server returned an invalid response. Please try again.');
  }

  return response as ForgotPasswordResponse;
}
