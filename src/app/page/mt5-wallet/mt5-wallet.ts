import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { getAllWallet } from '../../../shared/api/wallet/getAllWallet';
import { Button } from '../../components/ui/button/button';
import {
  CreateAccount,
  type WalletMode,
} from '../../components/mt5andWallet/create-account/create-account';
import { WalletAccountCard } from '../../components/mt5andWallet/wallet-account-card/wallet-account-card';
import { WalletAccountTable } from '../../components/mt5andWallet/wallet-account-table/wallet-account-table';
import { toWalletAccount, type WalletAccount } from './wallet-account';

@Component({
  selector: 'app-mt5-wallet',
  imports: [
    Button,
    CreateAccount,
    DecimalPipe,
    TitleCasePipe,
    WalletAccountCard,
    WalletAccountTable,
  ],
  templateUrl: './mt5-wallet.html',
})
export class Mt5Wallet {
  protected readonly views = [
    { key: 'grid', label: 'Grid View', icon: 'svg/sidebar/layout-dashboard.svg' },
    { key: 'table', label: 'Table View', icon: 'svg/icon/list.svg' },
  ] as const;
  protected readonly activeTab = signal<string | null>(null);
  protected readonly view = signal<'grid' | 'table'>('grid');
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly accountMode = signal<WalletMode | null>(null);
  protected readonly accountCreated = signal(false);
  private readonly accounts = signal<WalletAccount[]>([]);

  protected readonly tabs = computed(() => {
    const tradingTypes = this.accounts()
      .map(({ tradingType }) => tradingType)
      .filter(Boolean);
    return [null, ...new Set(tradingTypes)];
  });

  protected readonly visibleAccounts = computed(() => {
    const tab = this.activeTab();
    return tab === null
      ? this.accounts()
      : this.accounts().filter(({ tradingType }) => tradingType === tab);
  });

  protected readonly walletBalance = computed(() => {
    let total = 0;
    for (const account of this.accounts()) {
      if (!account.isActiveMainWallet) continue;
      if (account.balance === null) return null;
      total += account.balance;
    }
    return total;
  });

  constructor() {
    void this.loadAccounts();
  }

  protected openCreateAccount(mode: WalletMode): void {
    this.accountCreated.set(false);
    this.accountMode.set(mode);
  }

  protected closeCreateAccount(refreshAccounts: boolean): void {
    this.accountMode.set(null);
    if (refreshAccounts) void this.loadAccounts();
  }

  protected onAccountCreated(): void {
    this.accountMode.set(null);
    this.accountCreated.set(true);
    this.activeTab.set(null);
    void this.loadAccounts();
  }

  protected async loadAccounts(): Promise<void> {
    this.loadState.set('loading');
    try {
      const response = await getAllWallet();
      if (!response.result || !Array.isArray(response.data)) {
        this.loadState.set('error');
        return;
      }
      this.accounts.set(response.data.map(toWalletAccount));
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }
}
