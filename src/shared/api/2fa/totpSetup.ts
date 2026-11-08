import { authGuard } from '../../guard/auth';
import { api, isApiError } from '../api';

type DataResponse = {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
};

type TotpResponse = {
  result: boolean;
  message: string;
  data: DataResponse;
};

export async function totpSetup(): Promise<TotpResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const fallback = 'Unable to setup Google Authenticator. Please try again.';
  let data: TotpResponse;

  try {
    const response = await api.post<TotpResponse>('/v1/verify/totp/setup');
    data = response.data;
  } catch (error) {
    if (isApiError<{ message?: string; error?: { message?: string } }>(error)) {
      throw new Error(
        error.response?.data?.error?.message || error.response?.data?.message || fallback,
      );
    }
    throw new Error(fallback);
  }

  if (data?.result !== true) {
    throw new Error(data?.message || fallback);
  }

  return data;
}
