import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '../../button/button';
import { Checkbox } from '../../checkbox/checkbox';

@Component({
  selector: 'app-logout-confirmation',
  imports: [Button, Checkbox],
  host: { class: 'contents' },
  templateUrl: './logout-confirmation.html',
})
export class LogoutConfirmation implements AfterViewInit, OnDestroy {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('logoutDialog');

  readonly isLoggingOut = input(false);
  readonly canRemoveRememberedDevices = input(false);
  readonly errorMessage = input('');
  readonly confirmed = output<boolean>();
  readonly closed = output<void>();
  readonly removeRememberedDevices = signal(false);

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    if (this.dialog().nativeElement.open) {
      this.dialog().nativeElement.close();
    }
  }

  close(): void {
    if (!this.isLoggingOut()) {
      this.dialog().nativeElement.close();
      this.closed.emit();
    }
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }
}
