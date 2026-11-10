import { Component, input, output } from '@angular/core';
import { Button } from '../../ui/button/button';

@Component({
  imports: [Button],
  selector: 'app-phone-verify',
  styleUrl: './phone-verify.css',
  templateUrl: './phone-verify.html',
})
export class PhoneVerify {
  readonly isKyc = input<0 | 1>(0);
  readonly pending = input(false);
  readonly disabled = input(false);
  readonly verifyRequested = output<void>();
}
