import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Button } from '../../ui/button/button';
import type { WalletAccount } from '../../../page/mt5-wallet/wallet-account';

@Component({
  selector: 'app-wallet-account-card',
  imports: [Button, CurrencyPipe, TitleCasePipe],
  host: { class: 'block min-w-0' },
  templateUrl: './wallet-account-card.html',
})
export class WalletAccountCard {
  readonly account = input.required<WalletAccount>();
  readonly detailsRequested = output<string>();
  readonly addBalanceRequested = output<string>();
  readonly openLiveRequested = output<void>();
  protected readonly canOpenDetails = computed(() => {
    const number = this.account().number.trim();
    return this.account().status === 1 && !!number && number !== '—';
  });

  protected openDetails(): void {
    if (this.canOpenDetails()) this.detailsRequested.emit(this.account().number.trim());
  }
}
