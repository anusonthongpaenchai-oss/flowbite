import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

const allowedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const maxImageSize = 5 * 1024 * 1024;
export const kycIdTypes = ['National ID card', 'Passport', 'Driver License', 'Bill'] as const;
export type KycIdType = (typeof kycIdTypes)[number];

export type ImgVerifyRequest = {
  kycImage: File;
  kycIdType: KycIdType;
};

export type ImgVerifyResponse = {
  result: boolean;
  message: string;
  data: {
    kycIdType: string;
    imageUrl: string;
  };
};

export function kycImageError(file: File | null | undefined): string {
  if (!(file instanceof File) || file.size === 0) {
    return 'Please select an image file.';
  }
  if (!allowedImageTypes.has(file.type)) {
    return 'Please select a JPEG, JPG, or PNG image.';
  }
  if (file.size > maxImageSize) {
    return 'KYC image must be 5MB or smaller.';
  }
  return '';
}

export async function imgVerify(body: ImgVerifyRequest): Promise<ImgVerifyResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const validationError = kycImageError(body?.kycImage);
  if (validationError) {
    throw new Error(validationError);
  }
  if (!kycIdTypes.includes(body.kycIdType)) {
    throw new Error('Please select a valid ID document type.');
  }

  const formData = new FormData();
  formData.append('kycImage', body.kycImage);
  formData.append('kycIdType', body.kycIdType);
  let response: AxiosResponse<unknown>;

  try {
    response = await api.post<unknown>('/v1/verify/kyc/image', formData, {
      headers: { 'Content-Type': null },
      validateStatus: () => true,
    });
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      response = error.response;
    } else if (isAxiosError(error) && error.code === AxiosError.ERR_BAD_RESPONSE) {
      throw new Error('The server returned an invalid response. Please try again.');
    } else {
      throw new Error('Unable to connect. Please check your connection and try again.');
    }
  }

  const data = response.data as {
    result?: unknown;
    message?: unknown;
    error?: { message?: unknown };
  } | null;
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  const detail = typeof data?.error?.message === 'string' ? data.error.message.trim() : '';

  if (response.status < 200 || response.status >= 300 || data?.result === false) {
    throw new Error(detail || message || 'Unable to upload your KYC image. Please try again.');
  }

  if (data?.result !== true) {
    throw new Error(detail || 'The server returned an invalid response. Please try again.');
  }

  return response.data as ImgVerifyResponse;
}
