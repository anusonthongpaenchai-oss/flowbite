import { type AxiosResponse, isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

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

type dataSend = {
  memberRef: string;
  expiresAt: Date;
};

type errorSend = {
  result: boolean;
  message: string;
  error: {
    code: string;
    message: string;
  };
};

export type ResponseSendEmail = {
  memberRef: string;
  data: dataSend;
};

export type ResponseSendSms = {
  message: string;
  data: dataSend;
};

function requestError(error: unknown, fallback: string): Error {
  if (isAxiosError<errorSend>(error)) {
    const response = error.response?.data;
    return new Error(response?.error?.message || response?.message || fallback);
  }

  return new Error(fallback);
}

export async function sendSms(): Promise<ResponseSendSms> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }
  try {
    const response = await api.post<ResponseSendSms>('/v1/verify/sms/send');
    return response.data;
  } catch (error) {
    throw requestError(error, 'Failed to send SMS. Please try again.');
  }
}

export async function sendEmail(): Promise<ResponseSendEmail> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }
  try {
    const response = await api.post<ResponseSendEmail>('/v1/verify/email/send');
    return response.data;
  } catch (error) {
    throw requestError(error, 'Failed to send Email. Please try again.');
  }
}

export async function sendTotp() {}

export async function changPassword(body: RequestChangPassword): Promise<ResponseChangPassword> {
  if (!authGuard()) {
    throw new Error('Please sign in to change your password.');
  }

  let response: AxiosResponse<ResponseChangPassword>;

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
