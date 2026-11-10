import { api } from '../api';
import { authGuard } from '../../guard/auth';

type GetAllWalletResponseData = {
  id: number;
  memberId: number;
  wallet_account_name: string;
  wallet_type: string;
  wallet_trading_type: string;
  balance: number;
  equity?: number | string | null;
  Equity?: number | string | null;
  wallet_leverage: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
  member_id: number;
  wallet_account_no: string;
  wallet_balance: number;
  wallet_currency?: string | null;
  wallet_credit?: number | string | null;
  wallet_equity?: number | string | null;
  wallet_status: number;
};

type GetAllWalletResponse = {
  result: boolean;
  message: string;
  data: GetAllWalletResponseData[];
};

export async function getAllWallet(): Promise<GetAllWalletResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your profile.');
  }

  const response = await api.get<GetAllWalletResponse>('/v1/trading');
  return response.data;
}
