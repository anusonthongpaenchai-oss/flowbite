import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '@components/ui/button/button';
import { InputComponent } from '@components/ui/input/input';
import { sendEmail, sendSms, type SendOtpData } from '@shared/api/kyc/sendOtp';
import {
  changePasswordWallet,
  type PasswordRequest,
} from '@shared/api/wallet/changePasswordWallet';
import type { WalletDetail } from '@shared/api/wallet/getWalletId';
import {
  ConfirmPasswordWallet,
  type WalletPasswordChallenge,
} from '../confirm-password-wallet/confirm-password-wallet';

type ChangePasswordDetail = Pick<
  WalletDetail,
  'wallet_account_name' | 'wallet_account_no' | 'wallet_type'
>;

const sendError = 'Unable to send OTP. Please try again.';
const fallbackOtpLifetimeMs = 5 * 60_000;
const unixTimestampCutoffSeconds = 1_000_000_000;

function otpDeadline({ expiresAt, expiresIn }: SendOtpData): number {
  const receivedAt = Date.now();
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn >= 0) {
    return receivedAt + expiresIn * 1000;
  }

  const numericExpiry = typeof expiresAt === 'string' ? Number(expiresAt.trim() || NaN) : expiresAt;
  if (typeof numericExpiry === 'number' && Number.isFinite(numericExpiry) && numericExpiry >= 0) {
    // Numeric expiry may be a lifetime in seconds or a Unix timestamp.
    if (numericExpiry >= unixTimestampCutoffSeconds * 1000) return numericExpiry;
    if (numericExpiry >= unixTimestampCutoffSeconds) return numericExpiry * 1000;
    return receivedAt + numericExpiry * 1000;
  }

  const timestamp = expiresAt == null ? NaN : new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : receivedAt + fallbackOtpLifetimeMs;
}

@Component({
  imports: [Button, InputComponent, ConfirmPasswordWallet],
  selector: 'app-change-password-wallet',
  templateUrl: './change-password-wallet.html',
})
export class ChangePasswordWallet {
  readonly account = input.required<ChangePasswordDetail>();
  readonly type = input.required<PasswordRequest['type']>();
  readonly closed = output<string | null>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly password = signal('');
  protected readonly hasSpecialCharacter = computed(() => /[\p{P}\p{S}]/u.test(this.password()));
  protected readonly visible = signal(false);
  protected readonly method = signal<PasswordRequest['otpMethod'] | ''>('');
  protected readonly challenge = signal<WalletPasswordChallenge | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.busy()) this.close(null);
  }

  protected selectMethod(value: string): void {
    this.method.set(value === 'sms' || value === 'email' || value === 'totp' ? value : '');
  }

  protected async confirm(event: Event): Promise<void> {
    event.preventDefault();
    const method = this.method();
    if (this.busy() || this.challenge() || !this.hasSpecialCharacter() || !method) return;

    this.error.set('');
    if (method === 'totp') {
      this.visible.set(false);
      this.challenge.set({ method });
      return;
    }

    this.busy.set(true);
    try {
      const response = await (method === 'sms' ? sendSms() : sendEmail());
      if (this.destroyRef.destroyed) return;
      const memberRef = response?.data?.memberRef;
      if (typeof memberRef !== 'string' || !memberRef.trim()) {
        this.error.set(sendError);
        return;
      }

      this.visible.set(false);
      this.challenge.set({
        method,
        memberRef,
        expiresAt: otpDeadline(response.data),
      });
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.error.set(error instanceof Error ? error.message : sendError);
      }
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }

  protected async verify(code: string): Promise<void> {
    const challenge = this.challenge();
    if (this.busy() || !challenge) return;

    const password = this.password();
    this.busy.set(true);
    this.error.set('');
    try {
      await changePasswordWallet(this.account().wallet_account_no, {
        type: this.type(),
        password,
        ...(challenge.method === 'totp'
          ? { otpMethod: challenge.method, token: code }
          : { otpMethod: challenge.method, memberRef: challenge.memberRef, otpCode: code }),
      });
      if (!this.destroyRef.destroyed) this.close(password);
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Unable to change your password. Please try again.',
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }

  private close(password: string | null): void {
    this.password.set('');
    this.dialog().nativeElement.close();
    this.closed.emit(password);
  }
}
