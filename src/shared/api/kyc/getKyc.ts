import { authGuard } from '../../guard/auth';
import { api, type ApiResponse, isApiError } from '../api';

export type dataKycResponse = {
  id: number;
  member_id: number;
  kyc_type: string;
  kyc_id: string | null;
  kyc_id_type: string | null;
  kyc_image: string;
  kyc_image_url: string;
  kyc_image_session: number;
  kyc_stat: number;
  kyc_stat_text: string;
  kyc_reason: string;
  kyc_note: string;
  admin_id: null;
  createdAt: Date;
  updatedAt: Date;
};

export type KycResponse = {
  result: boolean;
  message: string;
  data: dataKycResponse;
};

export async function getKyc(): Promise<ApiResponse<KycResponse> | null> {
  if (!authGuard()) {
    throw new Error('Please sign in to update your profile.');
  }

  try {
    const response = await api.get<KycResponse>('/v1/verify/kyc');
    return response;
  } catch (error) {
    if (isApiError(error)) {
      console.error(error.response?.data);
    } else {
      console.error(error);
    }
    return null;
  }
}
