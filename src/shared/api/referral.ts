import { authGuard } from '../guard/auth';
import { api } from './api';

type refResponse = {
  result: boolean;
  message: string;
  data: {
    referralLink: string;
  };
  code: number;
};

export async function getReferralLink(): Promise<refResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your referral link.');
  }

  const response = await api.get<refResponse>('/v1/member/referral-link');
  return response.data;
}
