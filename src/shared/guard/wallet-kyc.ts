import { getUserInfo } from '../api/userInfo/userInfo';
import { getAuthSession, type AuthSession } from './auth';

export type WalletKycNotice = 'wallet-kyc-required' | 'wallet-kyc-unavailable';
type WalletKycStatus = 'verified' | WalletKycNotice;

let pending: { token: string; result: Promise<WalletKycStatus> } | undefined;

export function checkWalletKyc(): Promise<WalletKycStatus> {
  const session = getAuthSession();
  if (!session) return Promise.resolve('wallet-kyc-unavailable');
  if (pending?.token === session.accessToken) return pending.result;

  const result = readKyc(session).finally(() => {
    if (pending?.result === result) pending = undefined;
  });
  pending = { token: session.accessToken, result };
  return result;
}

async function readKyc(session: AuthSession): Promise<WalletKycStatus> {
  try {
    const { result, data } = await getUserInfo();
    const currentSession = getAuthSession();
    const memberId = data?.member?.id ?? data?.id;
    if (
      result !== true ||
      currentSession?.accessToken !== session.accessToken ||
      currentSession.member.id !== session.member.id ||
      (memberId !== undefined && memberId !== session.member.id)
    ) {
      return 'wallet-kyc-unavailable';
    }

    const isKyc = data?.member?.isKyc ?? data?.member?.isKYC ?? data?.isKyc ?? data?.isKYC;
    if (isKyc === 1) return 'verified';
    if (isKyc === 0) return 'wallet-kyc-required';
  } catch {
    return 'wallet-kyc-unavailable';
  }
  return 'wallet-kyc-unavailable';
}
