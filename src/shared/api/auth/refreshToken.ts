import { AxiosError, isAxiosError } from 'axios';
import { api } from '../api';

export type RefreshTokenResponse = {
  result: boolean | string;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
};

export class RefreshTokenError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export async function refreshToken(body: { refreshToken: string }): Promise<RefreshTokenResponse> {
  if (!body.refreshToken?.trim()) {
    throw new RefreshTokenError('Please sign in again.');
  }

  let res;
  try {
    res = await api.post<unknown>('/v1/auth/refresh', body, {
      validateStatus: () => true,
      timeout: 15_000,
    });
  } catch (error) {
    const invalidResponse = isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE;
    throw new RefreshTokenError(
      invalidResponse
        ? 'The server returned an invalid response. Please try again.'
        : 'Unable to connect. Please check your connection and try again.',
      !invalidResponse,
    );
  }

  const response = res.data as Partial<RefreshTokenResponse> | null;
  if (
    res.status < 200 ||
    res.status >= 300 ||
    (response?.result !== true && response?.result !== 'success')
  ) {
    throw new RefreshTokenError(
      typeof response?.message === 'string' && response.message.trim()
        ? response.message.trim()
        : 'Unable to refresh your session. Please sign in again.',
      res.status >= 500 || res.status === 408 || res.status === 429,
    );
  }

  const data = response.data;
  if (
    !data ||
    typeof data.accessToken !== 'string' ||
    !data.accessToken.trim() ||
    typeof data.refreshToken !== 'string' ||
    !data.refreshToken.trim() ||
    typeof data.expiresIn !== 'number' ||
    !Number.isFinite(data.expiresIn) ||
    data.expiresIn <= 0
  ) {
    throw new RefreshTokenError('The server returned an invalid authentication session.');
  }

  return response as RefreshTokenResponse;
}
