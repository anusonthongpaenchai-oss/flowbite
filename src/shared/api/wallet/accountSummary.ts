import { authGuard } from '../../guard/auth';
import { api } from '../api';

type SummaryData = {
  live: {
    current: number;
    max: number;
    remaining: number;
    limitType: string;
  };
  demo: {
    current: number;
    max: number;
    remaining: number;
    limitType: string;
  };
};

type SummaryResponse = {
  result: boolean;
  data: SummaryData;
};

export async function getAccountSummary(signal?: AbortSignal): Promise<SummaryResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your wallet.');
  }

  const response = await api.get<SummaryResponse>('/v1/wallet/account-summary', { signal });

  return response.data;
}
