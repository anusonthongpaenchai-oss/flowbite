import { authGuard } from '../../guard/auth';
import { api, type ApiResponse, isApiError } from '../api';

export type MemberRequest = {
  m_name: string;
  m_lastname: string;
  m_country: string;
  m_phone: string;
  m_gender: string;
  m_birthdate?: string;
};

export type AddressRequest = {
  address_no: string;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
};

export type ProfileUpdateRequest = {
  member: MemberRequest;
  address: AddressRequest;
};

export type ProfileUpdateResponse = {
  result: true;
  message: string;
};

export type ProfileField = keyof MemberRequest | keyof AddressRequest;

type FieldRule = {
  label: string;
  required: boolean;
  maxLength: number;
  pattern?: RegExp;
  formatMessage?: string;
};

const namePattern = /^[A-Za-z][A-Za-z .'’\-]*$/;
const fieldRules: Record<ProfileField, FieldRule> = {
  m_name: {
    label: 'First name',
    required: true,
    maxLength: 100,
    pattern: namePattern,
    formatMessage: 'Use English letters, spaces, apostrophes, periods, or hyphens.',
  },
  m_lastname: {
    label: 'Last name',
    required: true,
    maxLength: 100,
    pattern: namePattern,
    formatMessage: 'Use English letters, spaces, apostrophes, periods, or hyphens.',
  },
  m_country: { label: 'Country/Region', required: true, maxLength: 100 },
  m_phone: {
    label: 'Phone number',
    required: true,
    maxLength: 16,
    pattern: /^\+?\d{7,15}$/,
    formatMessage: 'Phone number must contain 7–15 digits, optionally starting with +.',
  },
  m_gender: { label: 'Gender', required: false, maxLength: 50 },
  m_birthdate: {
    label: 'Date of birth',
    required: false,
    maxLength: 10,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    formatMessage: 'Date of birth must be a valid date in YYYY-MM-DD format.',
  },
  address_no: { label: 'Address', required: true, maxLength: 255 },
  address_district: { label: 'Sub-district', required: true, maxLength: 100 },
  address_city: { label: 'District/City', required: true, maxLength: 100 },
  address_state: { label: 'Province/State', required: true, maxLength: 100 },
  address_zipcode: {
    label: 'ZIP/Postal code',
    required: true,
    maxLength: 20,
    pattern: /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/,
    formatMessage: 'Use letters, numbers, spaces, or hyphens for the postal code.',
  },
};

export function profileFieldError(field: ProfileField, value: unknown): string {
  const rule = fieldRules[field];

  if (typeof value !== 'string') {
    return rule.required || value != null ? `${rule.label} must be text.` : '';
  }

  const text = value.trim();
  if (!text) {
    return rule.required ? `${rule.label} is required.` : '';
  }
  if (text.length > rule.maxLength) {
    return `${rule.label} must be ${rule.maxLength} characters or fewer.`;
  }
  if (rule.pattern && !rule.pattern.test(text)) {
    return rule.formatMessage!;
  }
  if (field === 'm_birthdate') {
    const timestamp = Date.parse(`${text}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== text) {
      return rule.formatMessage!;
    }
  }
  return '';
}

export function normalizeProfileUpdateRequest(body: ProfileUpdateRequest): ProfileUpdateRequest {
  const normalize = <T extends MemberRequest | AddressRequest>(
    values: T,
    fields: ProfileField[],
  ): T => {
    const entries = fields.map((field) => {
      const value = values?.[field as keyof T];
      const message = profileFieldError(field, value);
      if (message) {
        throw new Error(message);
      }
      return [field, typeof value === 'string' ? value.trim() : ''];
    });
    return Object.fromEntries(entries) as T;
  };

  const memberFields: ProfileField[] = ['m_name', 'm_lastname', 'm_country', 'm_phone', 'm_gender'];
  if (body?.member?.m_birthdate !== undefined) {
    memberFields.push('m_birthdate');
  }

  return {
    member: normalize(body?.member, memberFields),
    address: normalize(body?.address, [
      'address_no',
      'address_district',
      'address_city',
      'address_state',
      'address_zipcode',
    ]),
  };
}

export async function profileUpdate(body: ProfileUpdateRequest): Promise<ProfileUpdateResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  const payload = normalizeProfileUpdateRequest(body);
  let res: ApiResponse<unknown>;

  try {
    res = await api.put<unknown>('/v1/member/profile/update', payload, {
      validateStatus: () => true,
    });
  } catch (error) {
    if (isApiError(error) && error.response) {
      res = error.response;
    } else if (isApiError(error) && error.invalidJson) {
      throw new Error('The server returned an invalid response. Please try again.');
    } else {
      throw new Error('Unable to connect. Please check your connection and try again.');
    }
  }

  const response = res.data as {
    result?: unknown;
    message?: unknown;
    error?: { message?: unknown };
  } | null;
  const message = typeof response?.message === 'string' ? response.message.trim() : '';
  const detail = typeof response?.error?.message === 'string' ? response.error.message.trim() : '';

  if (res.status < 200 || res.status >= 300 || response?.result === false) {
    throw new Error(
      detail ||
        message ||
        (res.status === 401 || res.status === 403
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to update your profile. Please try again.'),
    );
  }

  if (!response || response.result !== true) {
    throw new Error('The server returned an invalid response. Please try again.');
  }

  return { result: true, message: message || 'Profile updated successfully.' };
}
