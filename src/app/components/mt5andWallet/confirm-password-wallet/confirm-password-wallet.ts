import {
  Component,
  computed,
  ElementRef,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '@components/ui/button/button';
import { getUserInfo } from '@shared/api/userInfo/userInfo';
import type { PasswordRequest } from '@shared/api/wallet/changePasswordWallet';
import { getAuthSession } from '@shared/guard/auth';

export type WalletPasswordChallenge =
  | { method: 'totp' }
  | {
      method: Exclude<PasswordRequest['otpMethod'], 'totp'>;
      memberRef: string;
      expiresAt: number;
    };

@Component({
  imports: [Button],
  selector: 'app-confirm-password-wallet',
  templateUrl: './confirm-password-wallet.html',
})
export class ConfirmPasswordWallet {
  readonly challenge = input.required<WalletPasswordChallenge>();
  readonly busy = input(false);
  readonly error = input('');
  readonly cancelled = output<void>();
  readonly verified = output<string>();

  private readonly otpInput = viewChild.required<ElementRef<HTMLInputElement>>('otpInput');
  private readonly member = getAuthSession()?.member;
  private readonly destinationField = computed<'email' | 'm_phone'>(() =>
    this.challenge().method === 'email' ? 'email' : 'm_phone',
  );
  private readonly sessionDestination = computed(() => this.member?.[this.destinationField()]);
  private readonly profileDestination = resource({
    params: () => {
      const memberId = this.member?.id;
      return this.challenge().method !== 'totp' &&
        memberId !== undefined &&
        !this.sessionDestination()
        ? { memberId, field: this.destinationField() }
        : undefined;
    },
    loader: async ({ params: { memberId, field } }) => {
      const { result, data } = await getUserInfo();
      return result && data?.member?.id === memberId ? data.member[field] : '';
    },
  });
  private readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  protected readonly code = signal('');
  protected readonly positions = [0, 1, 2, 3, 4, 5];
  protected readonly channel = computed(() =>
    this.challenge().method === 'sms' ? 'SMS' : 'Email',
  );
  protected readonly destination = computed(
    () =>
      this.sessionDestination() ||
      (this.profileDestination.hasValue() ? this.profileDestination.value() : ''),
  );
  protected readonly remaining = computed(() => {
    const challenge = this.challenge();
    return challenge.method === 'totp'
      ? null
      : Math.max(0, Math.ceil((challenge.expiresAt - this.now()) / 1000));
  });
  protected readonly countdown = computed(() => {
    const remaining = this.remaining() ?? 0;
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  ngAfterViewInit(): void {
    this.otpInput().nativeElement.focus();
    if (this.remaining()) {
      this.timer = setInterval(() => {
        this.now.set(Date.now());
        if (this.remaining() === 0) clearInterval(this.timer);
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected enterCode(input: HTMLInputElement): void {
    const code = input.value.replace(/\D/g, '').slice(0, this.positions.length);
    if (input.value !== code) input.value = code;
    this.code.set(code);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.busy() && this.code().length === this.positions.length) {
      this.verified.emit(this.code());
    }
  }
}
