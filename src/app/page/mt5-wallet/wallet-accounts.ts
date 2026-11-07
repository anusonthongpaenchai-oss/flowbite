import { formatNumber } from '@angular/common';
import { computed, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { getAllWallet } from '../../../shared/api/wallet/getAllWallet';
import { toWalletAccount, type WalletAccount } from './wallet-account';

@Injectable()
export class WalletAccounts {
  private readonly locale = inject(LOCALE_ID);
  private readonly records = signal<WalletAccount[]>([]);
  private readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private requestId = 0;

  readonly accounts = this.records.asReadonly();
  readonly loadState = this.state.asReadonly();
  readonly balanceLabel = computed(() => {
    if (this.loadState() !== 'ready') return '— USD';

    let total = 0;
    for (const account of this.accounts()) {
      if (!account.isActiveMainWallet) continue;
      if (account.balance === null) return '— USD';
      total += account.balance;
    }
    return `${formatNumber(total, this.locale, total % 1 === 0 ? '1.0-0' : '1.2-2')} USD`;
  });

  reset(): void {
    this.requestId++;
    this.records.set([]);
    this.state.set('idle');
  }

  async load(): Promise<void> {
    if (this.state() === 'loading') return;
    const requestId = ++this.requestId;
    this.state.set('loading');
    try {
      const response = await getAllWallet();
      if (requestId !== this.requestId) return;
      if (!response.result || !Array.isArray(response.data)) {
        this.state.set('error');
        return;
      }
      this.records.set(response.data.map(toWalletAccount));
      this.state.set('ready');
    } catch {
      if (requestId === this.requestId) this.state.set('error');
    }
  }
}
