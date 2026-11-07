import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import type { WalletAccount } from '../../../page/mt5-wallet/wallet-account';

@Component({
  selector: 'app-wallet-account-table',
  imports: [CurrencyPipe, TitleCasePipe],
  host: { class: 'block' },
  templateUrl: './wallet-account-table.html',
})
export class WalletAccountTable {
  readonly accounts = input.required<readonly WalletAccount[]>();
  readonly detailsRequested = output<string>();
}
