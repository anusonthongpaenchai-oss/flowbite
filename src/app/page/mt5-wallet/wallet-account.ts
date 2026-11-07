import type { getAllWallet } from '../../../shared/api/wallet/getAllWallet';

type WalletRecord = Awaited<ReturnType<typeof getAllWallet>>['data'][number];

export type WalletAccount = {
  id: number;
  name: string;
  number: string;
  tradingType: string;
  type: string;
  balance: number | null;
  equity: number | null;
  isActiveMainWallet: boolean;
};

export function toWalletAccount(wallet: WalletRecord): WalletAccount {
  const type = wallet.wallet_type?.trim().toLowerCase();
  const tradingType = wallet.wallet_trading_type?.trim().toLowerCase() ?? '';
  const amount = wallet.wallet_balance ?? wallet.balance;
  const balance = amount == null ? NaN : Number(amount);
  const equityAmount = wallet.wallet_equity ?? wallet.equity ?? wallet.Equity;
  const equity =
    equityAmount == null || String(equityAmount).trim() === '' ? NaN : Number(equityAmount);

  return {
    id: wallet.id,
    name: wallet.wallet_account_name?.trim() || 'Unnamed account',
    number: wallet.wallet_account_no || '—',
    tradingType,
    type: type || '—',
    balance: Number.isFinite(balance) ? balance : null,
    equity: Number.isFinite(equity) ? equity : null,
    isActiveMainWallet: type === 'main' && (wallet.wallet_status ?? wallet.status) !== 0,
  };
}
