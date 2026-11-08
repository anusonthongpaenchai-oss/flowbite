import { authGuard } from '../../guard/auth';
import { api, isApiError } from '../api';

type TotpVerifySetupRequest = {
  token: string;
};

type TotpVerifySetupResponse = {
  result: boolean;
  message: string;
};

export async function totpVerifySetup(
  requestData: TotpVerifySetupRequest,
): Promise<TotpVerifySetupResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const fallback = 'Unable to verify Google Authenticator. Please try again.';
  let data: TotpVerifySetupResponse;

  try {
    const response = await api.post<TotpVerifySetupResponse>(
      '/v1/verify/totp/verify-setup',
      requestData,
    );
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
