import { authGuard } from '../guard/auth';
import { api } from './api';

export type ActiveSession = {
  session_uid: string;
  session_agent: string;
  session_browser: string;
  session_os: string;
  session_city: string;
  session_country: string;
  session_ip: string;
  session_time: number;
  session_expire: number;
  session_latest: number | string | null;
};

type ActivePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type ActiveResponse = {
  result: boolean;
  message: string;
  data: ActiveSession[];
  referralLink?: string;
  pagination: ActivePagination;
  code: number;
};

export async function getActiveUser(page = 1): Promise<ActiveResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your active sessions.');
  }

  const query = page === 1 ? '' : `?page=${page}`;
  const response = await api.get<ActiveResponse>(`/v1/auth/sessions/active${query}`);
  return response.data;
}
