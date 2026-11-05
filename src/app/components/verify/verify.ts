import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Button } from '../button/button';

@Component({
  imports: [Button],
  selector: 'app-verify-status',
  styleUrl: './verify.css',
  templateUrl: './verify.html',
})
export class Verify {
  @Input() variant: 'pending' | 'approve' | 'reject' | 'None' = 'None';
  @Input() reason = '';
  @Input() busy = false;
  @Output() readonly verifyRequested = new EventEmitter<void>();

  public readonly shieldIcon = 'svg/kyc/shield-check.svg';
  public readonly approveIcon = 'svg/icon/approve.svg';
  public readonly rejectIcon = 'svg/icon/x.svg';

  public requestVerification(): void {
    if (this.busy || (this.variant !== 'None' && this.variant !== 'reject')) {
      return;
    }
    this.verifyRequested.emit();
  }
}
