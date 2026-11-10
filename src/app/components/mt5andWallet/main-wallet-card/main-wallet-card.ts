import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { Button } from '@components/ui/button/button';

@Component({
  imports: [Button],
  selector: 'app-main-wallet-card',
  styleUrl: './main-wallet-card.css',
  templateUrl: './main-wallet-card.html',
})
export class MainWalletCard {
  readonly balanceLabel = input.required<string>();
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.closed.emit();
  }
}
