import { api } from '../api';
import type { CreateWalletRequest } from './createWallet';

type WalletLeveragesResponse = {
  result: boolean;
  data: { leverages: number[] };
};

export async function getWalletLeverages(
  accountType: CreateWalletRequest['wallet_account_type'],
  signal: AbortSignal,
): Promise<number[]> {
  const { data } = await api.get<WalletLeveragesResponse>(
    `/v1/trading/wallet-type/${accountType}/leverages`,
    { signal, timeout: 10_000 },
  );
  if (data?.result !== true || !Array.isArray(data.data?.leverages)) {
    throw new Error('Unable to load leverage options.');
  }
  return [...new Set(data.data.leverages.filter((value) => Number.isInteger(value) && value > 0))];
}
