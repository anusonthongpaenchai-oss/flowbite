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
  readonly mainBalance = computed(() => this.activeTotal('main', 'balance'));
  readonly pointsCredit = computed(() => this.activeTotal('point', 'credit'));
  readonly balanceLabel = computed(() => {
    const total = this.mainBalance();
    if (total === null) return '— USD';
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

  private activeTotal(type: 'main' | 'point', field: 'balance' | 'credit'): number | null {
    if (this.loadState() !== 'ready') return null;

    let total = 0;
    for (const account of this.accounts()) {
      if (account.type !== type || account.status !== 1) continue;
      const amount = account[field];
      if (amount === null) return null;
      total += amount;
    }
    return total;
  }
}
