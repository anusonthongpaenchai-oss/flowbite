import { isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

type SendOtpData = {
  memberRef: string;
  expiresAt: Date;
};

type SendOtpError = {
  result: boolean;
  message: string;
  error: {
    code: string;
    message: string;
  };
};

export type ResponseSendEmail = {
  memberRef: string;
  data: SendOtpData;
};

export type ResponseSendSms = {
  message: string;
  data: SendOtpData;
};

function requestError(error: unknown, fallback: string): Error {
  if (isAxiosError<SendOtpError>(error)) {
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