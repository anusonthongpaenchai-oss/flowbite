import { CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import type { WalletAccount } from '../../../page/mt5-wallet/wallet-account';
import { MainWalletCard } from '../main-wallet-card/main-wallet-card';

@Component({
  selector: 'app-wallet-account-table',
  imports: [CurrencyPipe, DecimalPipe, MainWalletCard, TitleCasePipe],
  host: { class: 'block' },
  templateUrl: './wallet-account-table.html',
})
export class WalletAccountTable {
  readonly accounts = input.required<readonly WalletAccount[]>();
  readonly detailsRequested = output<string>();

  private readonly pageSize = 10;
  protected readonly searchQuery = signal('');
  protected readonly selectedType = signal('');
  protected readonly selectedWallet = signal<WalletAccount | null>(null);

  private readonly rows = computed(() =>
    this.accounts().map((account) => ({
      account,
      type: account.status === 0 ? 'inactive' : this.activeType(account),
    })),
  );
  protected readonly types = computed(() => [...new Set(this.rows().map(({ type }) => type))]);
  private readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedType = this.selectedType();
    return this.rows().filter(
      ({ account, type }) =>
        (selectedType ? type === selectedType : type !== 'inactive') &&
        (account.name.toLowerCase().includes(query) ||
          account.number.toLowerCase().includes(query)),
    );
  });

  protected readonly page = linkedSignal({ source: this.filteredRows, computation: () => 1 });
  protected readonly total = computed(() => this.filteredRows().length);
  protected readonly pageCount = computed(() => Math.ceil(this.total() / this.pageSize));
  protected readonly startIndex = computed(() => (this.page() - 1) * this.pageSize);
  protected readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize, this.total()),
  );
  protected readonly pageRows = computed(() =>
    this.filteredRows().slice(this.startIndex(), this.endIndex()),
  );
  protected readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);

    const start = Math.max(2, Math.min(this.page() - 1, count - 3));
    return [
      1,
      ...(start > 2 ? [null] : []),
      start,
      start + 1,
      start + 2,
      ...(start + 3 < count ? [null] : []),
      count,
    ];
  });

  protected openDetails(account: WalletAccount): void {
    if (account.type === 'main') {
      this.selectedWallet.set(account);
    } else {
      this.detailsRequested.emit(account.number.trim());
    }
  }

  private activeType(account: WalletAccount): string {
    if (account.type === 'main') return 'wallet';
    return account.tradingType || 'other';
  }
}
