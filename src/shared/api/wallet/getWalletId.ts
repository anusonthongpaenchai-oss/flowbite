import { api } from '../api';
import { authGuard } from '../../guard/auth';

export type WalletDetail = {
  id: number;
  memberId: number;
  wallet_account_name: string;
  wallet_type: string;
  wallet_trading_type: string;
  balance: number;
  wallet_leverage: number;
  status: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  member_id: number;
  wallet_account_no: string;
  wallet_balance: number;
  wallet_status: number;
  wall_account_type?: number | string | null;
  wallet_account_type?: number | string | null;
  wallet_currency?: string | null;
  wallet_master_password?: string | null;
  wallet_investor_password?: string | null;
  wallet_credit?: number | string | null;
  wallet_equity?: number | string | null;
  wallet_margin?: number | string | null;
};

export type Mt5Data = {
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

export type WalletResponseData = {
  wallet: WalletDetail;
  mt5_data?: Mt5Data | null;
};

export type WalletResponse = {
  result: boolean;
  message: string;
  data: WalletResponseData;
};

export async function getWalletId(
  accountNumber: string,
  signal?: AbortSignal,
): Promise<WalletResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your wallet.');
  }

  const response = await api.get<WalletResponse>(
    `/v1/wallet/user/${encodeURIComponent(accountNumber)}`,
    { signal },
  );
  return response.data;
}
