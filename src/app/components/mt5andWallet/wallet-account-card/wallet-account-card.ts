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
  protected readonly hasAccountNumber = computed(() => {
    const number = this.account().number.trim();
    return !!number && number !== '—';
  });

  protected openDetails(): void {
    if (this.hasAccountNumber()) this.detailsRequested.emit(this.account().number.trim());
  }
}
