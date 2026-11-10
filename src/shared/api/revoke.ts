import { authGuard } from '../guard/auth';
import { api } from './api';

type RevokeRequest = {
  sessionUid: string;
};

type RevokeData = {
  sessionRevoked: boolean;
  sessionUid: string;
  revokedAt: Date;
};
type RevokeResponse = {
  result: boolean;
  message: string;
  data: RevokeData;
  code: number;
};

export async function revokeUserSession(request: RevokeRequest) {
  if (!authGuard()) {
    throw new Error('Please sign in to manage your active sessions.');
  }

  const response = await api.post<RevokeResponse>('/v1/auth/session/revoke', request);
  return response.data;
}
