import { CurrencyPipe } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { MainWalletCard } from '../main-wallet-card/main-wallet-card';

@Component({
  imports: [CurrencyPipe, MainWalletCard],
  selector: 'app-main-wallet',
  styleUrl: './main-wallet.css',
  templateUrl: './main-wallet.html',
})
export class MainWallet {
  readonly balance = input.required<number | null>();
  protected readonly detailsOpen = signal(false);
}
