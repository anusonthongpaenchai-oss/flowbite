import { authGuard } from '../../guard/auth';
import { api, type ApiResponse, isApiError } from '../api';

const allowedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const maxImageSize = 5 * 1024 * 1024;

export function profileImageError(file: File | null | undefined): string {
  if (!(file instanceof File) || file.size === 0) {
    return 'Please select an image file.';
  }
  if (!allowedImageTypes.has(file.type)) {
    return 'Please select a JPEG, JPG, or PNG image.';
  }
  if (file.size > maxImageSize) {
    return 'Profile image must be 5MB or smaller.';
  }
  return '';
}

export async function imgUpdate(file: File): Promise<unknown> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const validationError = profileImageError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append('profileImage', file);
  let response: ApiResponse<unknown>;

  try {
    response = await api.post<unknown>('/v1/member/profile/image', formData, {
      validateStatus: () => true,
    });
  } catch (error) {
    if (isApiError(error) && error.response) {
      response = error.response;
    } else if (isApiError(error) && error.invalidJson) {
      throw new Error('The server returned an invalid response. Please try again.');
    } else {
      throw new Error('Unable to connect. Please check your connection and try again.');
    }
  }

  const data = response.data as {
    result?: boolean;
    message?: string;
    error?: { message?: string | { imageUrl?: string; thumbnailUrl?: string } };
  } | null;
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  const errorMessage = data?.error?.message;
  const detail =
    typeof errorMessage === 'string'
      ? errorMessage.trim()
      : typeof errorMessage?.imageUrl === 'string'
        ? errorMessage.imageUrl.trim()
        : '';

  if (response.status < 200 || response.status >= 300 || data?.result === false) {
    throw new Error(detail || message || 'Unable to update your profile image. Please try again.');
  }

  return response.data;
}
