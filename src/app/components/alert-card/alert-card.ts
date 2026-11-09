import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-alert-card',
  templateUrl: './alert-card.html',
})
export class AlertCard {
  readonly pending = input(false);
  readonly error = input('');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (this.pending()) return;
    this.dialog().nativeElement.close();
    this.cancelled.emit();
  }

  protected confirm(): void {
    if (!this.pending()) this.confirmed.emit();
  }
}
