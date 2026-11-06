import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { api } from '../api';
import type { LoginData } from '../auth/login';

export type TwoFaVerifyRequest = {
  preAuthToken: string;
  totpToken: string;
  rememberDevice: boolean;
};

export type TwoFaVerifyResponse = {
  result: boolean;
  message: string;
  data: LoginData;
};

type VerifyPayload = Partial<TwoFaVerifyResponse> & {
  error?: { message?: string };
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function twoFaVerify(body: TwoFaVerifyRequest): Promise<TwoFaVerifyResponse> {
  let res: AxiosResponse<unknown>;

  try {
    res = await api.post<unknown>('/v1/auth/2fa/verify', body, {
      validateStatus: () => true,
    });
  } catch (error) {
    if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    }

    throw new Error('Unable to connect. Please check your connection and try again.');
  }

  const response = res.data as VerifyPayload | null;

  if (res.status < 200 || res.status >= 300 || response?.result === false) {
    const detail =
      typeof response?.error?.message === 'string' ? response.error.message.trim() : '';
    const message = typeof response?.message === 'string' ? response.message.trim() : '';
    throw new Error(
      detail || message || `Unable to verify your code (HTTP ${res.status}). Please try again.`,
    );
  }

  const session = response?.data;
  if (
    response?.result !== true ||
    typeof response.message !== 'string' ||
    session?.require2FA !== false ||
    !nonEmptyString(session.accessToken) ||
    !nonEmptyString(session.refreshToken) ||
    !nonEmptyString(session.sessionUid) ||
    typeof session.expiresIn !== 'number' ||
    !Number.isFinite(session.expiresIn) ||
    session.expiresIn <= 0 ||
    !session.member ||
    typeof session.member !== 'object' ||
    Array.isArray(session.member) ||
    typeof session.member.id !== 'number' ||
    !Number.isFinite(session.member.id) ||
    typeof session.member.username !== 'string' ||
    typeof session.member.email !== 'string'
  ) {
    throw new Error('The server returned an invalid response. Please try again.');
  }

  return response as TwoFaVerifyResponse;
}
