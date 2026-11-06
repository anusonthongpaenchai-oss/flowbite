import { isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

export type OtpVerifyRequest = {
  memberRef: string;
  otpCode: string;
  optional: string;
};

export type OtpVerifyResponse = {
  result: boolean;
  message: string;
};

type OtpApiResponse = OtpVerifyResponse & {
  error?: {
    code?: string;
    message?: string;
  };
};

async function verifyOtp(
  endpoint: string,
  body: OtpVerifyRequest,
  fallback: string,
): Promise<OtpVerifyResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  let data: OtpApiResponse;

  try {
    const response = await api.post<OtpApiResponse>(endpoint, body);
    data = response.data;
  } catch (error) {
    if (isAxiosError<OtpApiResponse>(error)) {
      const response = error.response?.data;
      throw new Error(response?.error?.message || response?.message || fallback);
    }
    throw new Error(fallback);
  }

  if (data?.result !== true) {
    throw new Error(data?.error?.message || data?.message || fallback);
  }

  return data;
}

export async function smsVerify(body: OtpVerifyRequest): Promise<OtpVerifyResponse> {
  return verifyOtp('/v1/verify/sms/verify', body, 'Failed to verify SMS OTP. Please try again.');
}

export async function emailVerify(body: OtpVerifyRequest): Promise<OtpVerifyResponse> {
  return verifyOtp(
    '/v1/verify/email/verify',
    body,
    'Failed to verify email OTP. Please try again.',
  );
}
