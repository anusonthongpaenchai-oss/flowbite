import { api } from '../api';
import { authGuard } from '../../guard/auth';

type DepositWalletRequest = {
  balance: number;
  comment: string;
};

type WalletDataDeposit = {
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

type DepositDemoResponse = {
  result: boolean;
  message: string;
  data: {
    wallet: WalletDataDeposit[];
    mt5_response: {};
  };
  code: number;
};

export async function depositDemoWallet(
  accountNumber: string,
  request: DepositWalletRequest,
): Promise<DepositDemoResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to deposit into your demo account.');
  }

  const response = await api.post<DepositDemoResponse>(
    `/v1/wallet/trade/balance/${encodeURIComponent(accountNumber)}/deposit`,
    request,
  );
  return response.data;
}
