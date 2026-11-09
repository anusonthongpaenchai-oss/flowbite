import { api } from '../api';
import { authGuard } from '../../guard/auth';
import type { WalletDetail } from './getWalletId';

type EditLeverageResponse = {
  result: boolean;
  message: string;
  data?: { wallet?: Pick<WalletDetail, 'wallet_leverage'> };
};

export async function editLeverages(
  accountNumber: string,
  leverage: number,
): Promise<EditLeverageResponse> {
  if (!authGuard()) {
    throw new Error('Please sign in to change your leverage.');
  }

  const response = await api.patch<EditLeverageResponse>(
    `/v1/wallet/user/${accountNumber}/leverage`,
    { leverage },
    { timeout: 30_000 },
  );
  return response.data;
}
