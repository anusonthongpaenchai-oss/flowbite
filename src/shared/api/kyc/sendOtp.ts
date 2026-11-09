import { authGuard } from '../../guard/auth';
import { api, isApiError } from '../api';

export type SendOtpData = {
  memberRef: string;
  expiresAt?: Date | string | number | null;
  expiresIn?: number | null;
};

type SendOtpStatus = {
  result?: boolean;
  message?: string;
};

export type ResponseSendEmail = {
  memberRef: string;
  data: SendOtpData;
};

export type ResponseSendSms = {
  message: string;
  data: SendOtpData;
};

async function requestOtp<T>(method: 'sms' | 'email', fallback: string): Promise<T> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const { data } = await api
    .post<T & SendOtpStatus>(`/v1/verify/${method}/send`)
    .catch((error: unknown) => {
      const response = isApiError<SendOtpStatus>(error) ? error.response?.data : undefined;
      throw new Error(response?.message || fallback);
    });

  if (data?.result === false) {
    throw new Error(data.message || fallback);
  }
  return data;
}

export function sendSms(): Promise<ResponseSendSms> {
  return requestOtp('sms', 'Failed to send SMS. Please try again.');
}

export function sendEmail(): Promise<ResponseSendEmail> {
  return requestOtp('email', 'Failed to send Email. Please try again.');
}

export async function sendTotp() {}
