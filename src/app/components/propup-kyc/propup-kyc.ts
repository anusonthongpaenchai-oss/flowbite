import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-propup-kyc',
  templateUrl: './propup-kyc.html',
})
export class PropupKyc implements AfterViewInit, OnDestroy {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly verificationRequired = input(true);
  readonly confirmed = output<void>();
  readonly closed = output<void>();

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected confirm(): void {
    this.dialog().nativeElement.close();
    this.confirmed.emit();
  }
}
