import { isAxiosError } from 'axios';
import { api } from '../api';
import { authGuard } from '../../guard/auth';

export type CreateWalletRequest = {
  wallet_account_type: 1 | 2 | 3 | 4;
  wallet_leverage: number;
  wallet_trading_type: 'demo' | 'live';
  wallet_account_name: string;
  wallet_balance?: number;
};

export type CreateWalletAccount = {
  id: number;
  memberId: number;
  wallet_account_name: string;
  wallet_type: string;
  wallet_trading_type: string;
  balance: number;
  wallet_leverage: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  member_id: number;
  wallet_account_no: string;
  wallet_balance: number;
  wallet_status: number;
};

export type CreateWalletMt5Account = {
  Login: string;
  login: number;
  Balance: number;
  balance: number;
  Credit: number;
  credit: number;
  Equity: number;
  equity: number;
  Margin: number;
  margin: number;
  MarginFree: number;
  marginFree: number;
  Leverage: number;
  leverage: number;
  Group: string;
  group: string;
  currency: string;
  server: string;
};

export type CreateWalletResponseData = {
  wallet: CreateWalletAccount;
  mt5_account: CreateWalletMt5Account;
  account_type: string;
  account_prefix: string;
};

export type CreateWalletResponse = {
  result: boolean;
  message: string;
  data: CreateWalletResponseData;
};

export class WalletCreationUnconfirmedError extends Error {}

export async function createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to open an account.');
  }

  const fallback = 'Unable to open an account. Please try again.';
  try {
    const response = await api.post<CreateWalletResponse>('/v1/wallet/user/add', request, {
      timeout: 45_000,
    });
    if (response.data?.result !== true) {
      throw new Error(response.data?.message || fallback);
    }
    return response.data;
  } catch (error) {
    if (isAxiosError<{ message?: string; error?: { message?: string } }>(error)) {
      if (!error.response || error.response.status >= 500) {
        throw new WalletCreationUnconfirmedError(
          'Could not confirm whether the account was opened. Close this window to refresh your accounts before trying again.',
        );
      }
      throw new Error(
        error.response.data?.error?.message || error.response.data?.message || fallback,
      );
    }
    throw error;
  }
}
