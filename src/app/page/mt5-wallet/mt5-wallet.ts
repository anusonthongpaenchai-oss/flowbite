import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '../../components/ui/button/button';
import { CardWallet } from '../../components/mt5andWallet/card-wallet/card-wallet';
import {
  CreateAccount,
  type WalletMode,
} from '../../components/mt5andWallet/create-account/create-account';
import { DepositDemo } from '../../components/mt5andWallet/deposit-demo/deposit-demo';
import { MainWallet } from '../../components/mt5andWallet/main-wallet/main-wallet';
import { WalletAccountCard } from '../../components/mt5andWallet/wallet-account-card/wallet-account-card';
import { WalletAccountTable } from '../../components/mt5andWallet/wallet-account-table/wallet-account-table';
import { WalletAccounts } from './wallet-accounts';

@Component({
  selector: 'app-mt5-wallet',
  imports: [
    Button,
    CardWallet,
    CreateAccount,
    DepositDemo,
    MainWallet,
    TitleCasePipe,
    WalletAccountCard,
    WalletAccountTable,
  ],
  templateUrl: './mt5-wallet.html',
})
export class Mt5Wallet {
  private readonly router = inject(Router);
  private readonly walletAccounts = inject(WalletAccounts);

  protected readonly views = [
    { key: 'grid', label: 'Grid View', icon: 'svg/sidebar/layout-dashboard.svg' },
    { key: 'table', label: 'Table View', icon: 'svg/icon/list.svg' },
  ] as const;
  protected readonly activeTab = signal<string | null>(null);
  protected readonly view = signal<'grid' | 'table'>('grid');
  protected readonly loadState = this.walletAccounts.loadState;
  protected readonly accountMode = signal<WalletMode | null>(null);
  protected readonly selectedAccountNumber = signal<string | null>(null);
  protected readonly depositAccountNumber = signal<string | null>(null);
  protected readonly accountCreated = signal(false);
  private readonly accounts = computed(() =>
    this.walletAccounts
      .accounts()
      .filter(
        ({ type, status }) =>
          !['main', 'point', 'lot', 'rebase'].includes(type) && (status === 0 || status === 1),
      ),
  );
  protected readonly walletBalanceLabel = this.walletAccounts.balanceLabel;

  private readonly mainWallet = computed(() => {
    const accounts = this.walletAccounts.accounts();
    return (
      accounts.find((account) => account.isActiveMainWallet) ??
      accounts.find((account) => account.type === 'main')
    );
  });
  protected readonly visibleMainWallet = computed(() => {
    const tab = this.activeTab();
    return tab === null || tab === 'wallet' ? this.mainWallet() : undefined;
  });
  protected readonly tableAccounts = computed(() => {
    const wallet = this.mainWallet();
    const tradingAccounts = this.accounts().filter(({ type }) => type === 'trading');
    return wallet && (wallet.status === 0 || wallet.status === 1)
      ? [wallet, ...tradingAccounts]
      : tradingAccounts;
  });

  protected readonly tabs = computed(() => {
    const tradingTypes = this.accounts()
      .filter(({ status, type }) => status === 1 && type === 'trading')
      .map(({ tradingType }) => tradingType)
      .filter((type) => !!type && type !== 'wallet' && type !== 'inactive');
    return [null, ...new Set(tradingTypes), 'wallet', 'inactive'];
  });

  protected readonly visibleAccounts = computed(() => {
    const tab = this.activeTab();
    if (tab === 'wallet') return [];
    return this.accounts().filter(({ status, type, tradingType }) =>
      tab === 'inactive' && type === 'trading'
        ? status === 0
        : status === 1 && type === 'trading' && (tab === null || tradingType === tab),
    );
  });

  constructor() {
    void this.loadAccounts();
  }

  protected closeDeposit(refreshAccounts: boolean): void {
    this.depositAccountNumber.set(null);
    if (refreshAccounts) void this.loadAccounts();
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

  protected onVerificationRequired(): void {
    this.accountMode.set(null);
    this.walletAccounts.reset();
    void this.router.navigateByUrl('/dashboard', { info: 'wallet-kyc-required' });
  }

  protected onAccountDeleted(): void {
    this.accountCreated.set(false);
    this.activeTab.set(null);
    void this.loadAccounts();
  }

  protected loadAccounts(): Promise<void> {
    return this.walletAccounts.load();
  }
}
