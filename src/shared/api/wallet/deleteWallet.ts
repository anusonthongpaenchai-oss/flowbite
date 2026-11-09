import { api } from '../api';
import { authGuard } from '../../guard/auth';

type WalletDataDelete = {
  id: string;
  memberId: number;
  wallet_account_name: string;
  wallet_type: string;
  wallet_trading_type: string;
  balance: number;
  wallet_leverage: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
  member_id: number;
  wallet_account_no: string;
  wallet_balance: number;
  wallet_status: number;
};

type DeleteWalletResponse = {
  result: boolean;
  message: string;
  data: {
    wallet: WalletDataDelete[];
    mt5_response: {};
  };
  code: number;
};

export async function deleteWallet(accountNumber: string): Promise<DeleteWalletResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to view your profile.');
  }

  try {
    const response = await api.delete<DeleteWalletResponse>(
      `/v1/wallet/user/${encodeURIComponent(accountNumber)}`,
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}
