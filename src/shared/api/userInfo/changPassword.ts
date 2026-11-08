import { authGuard } from '../../guard/auth';
import { api, type ApiResponse, isApiError } from '../api';

export type RequestChangPassword = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otpMethod: 'sms' | 'email';
  memberRef: string;
  otpCode: string;
  token: string;
};

export type ResponseChangPassword = {
  result: boolean;
  message: string;
};

type errorSend = {
  result: boolean;
  message: string;
  error: {
    code: string;
    message: string;
  };
};

function requestError(error: unknown, fallback: string): Error {
  if (isApiError<errorSend>(error)) {
    const response = error.response?.data;
    return new Error(response?.error?.message || response?.message || fallback);
  }

  return new Error(fallback);
}

export async function changPassword(body: RequestChangPassword): Promise<ResponseChangPassword> {
  if (!authGuard()) {
    throw new Error('Please sign in to change your password.');
  }

  let response: ApiResponse<ResponseChangPassword>;

  try {
    response = await api.put<ResponseChangPassword>('/v1/member/change-password', body);
  } catch (error) {
    throw requestError(error, 'Failed to change password. Please try again.');
  }

  if (response.data.result === false) {
    throw new Error(response.data.message || 'Failed to change password. Please try again.');
  }

  return response.data;
}
