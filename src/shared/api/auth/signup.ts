import { api, isApiError } from '../api';

type signupRequest = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneCode: string;
  phoneNumber: string;
  country: string;
  referralCode?: string;
  saleCode?: string;
  terms: boolean;
};

type errorResponse = {
  code: number;
  message: string;
};

type signupError = {
  result: boolean;
  message: string;
  error: errorResponse;
};

export interface signupResponse {
  result: boolean;
  message: string;
}

export async function signupUser(data: signupRequest): Promise<signupResponse> {
  try {
    const response = await api.post<signupResponse>('/v1/member/register', data);
    return response.data;
  } catch (error) {
    if (isApiError<signupError>(error)) {
      const payload = error.response?.data;
      const detail =
        typeof payload?.error?.message === 'string' ? payload.error.message.trim() : '';
      const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
      throw new Error(
        detail ||
          message ||
          (error.response
            ? `Unable to register (HTTP ${error.response.status}). Please try again.`
            : 'Unable to connect. Please check your connection and try again.'),
      );
    }
    throw error;
  }
}
