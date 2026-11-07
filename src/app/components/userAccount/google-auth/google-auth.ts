import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  model,
  PendingTasks,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { totpSetup } from '../../../../shared/api/2fa/totpSetup';
import { totpVerifySetup } from '../../../../shared/api/2fa/totpVerifySetup';
import { Button } from '../../ui/button/button';

type SetupStep = 'preparation' | 'setup' | 'verify' | 'complete';

@Component({
  imports: [QRCodeComponent, Button],
  selector: 'app-google-auth',
  styleUrl: './google-auth.css',
  templateUrl: './google-auth.html',
})
export class GoogleAuth {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('authDialog');
  private readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpDigit');

  readonly require2fa = model(false);
  readonly isEnabled = computed(() => this.require2fa());
  readonly isOpen = signal(false);
  readonly step = signal<SetupStep>('preparation');
  readonly qrPath = signal('');
  readonly backupCodes = signal<string[]>([]);
  readonly isSubmitting = signal(false);
  readonly isVerifying = signal(false);
  readonly isBusy = computed(() => this.isSubmitting() || this.isVerifying());
  readonly errorMessage = signal('');
  readonly copyMessage = signal('');
  readonly otpPositions = [0, 1, 2, 3, 4, 5];
  readonly otpDigits = signal(this.otpPositions.map(() => ''));
  readonly verifyToken = computed(() => this.otpDigits().join(''));
  readonly stepIndex = computed(() =>
    this.step() === 'complete' ? 3 : this.step() === 'verify' ? 2 : 1,
  );
  readonly canVerify = computed(
    () =>
      this.step() === 'verify' &&
      !!this.qrPath() &&
      !this.isEnabled() &&
      !this.isBusy() &&
      /^\d{6}$/.test(this.verifyToken()),
  );
  readonly preparationItems = [
    { icon: 'svg/kyc/click.svg', text: 'Download Google Authenticator app on your phone' },
    { icon: 'svg/icon/mail-fast.svg', text: 'Make sure you have access to your email' },
    { icon: 'svg/icon/cloud-upload.svg', text: 'Keep your backup codes in a safe place' },
  ];

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (this.isOpen() && dialog && !dialog.open) {
        dialog.showModal();
      }
      if (this.isOpen() && this.step() === 'verify') {
        this.otpInputs()[0]?.nativeElement.focus();
      }
    });
    this.destroyRef.onDestroy(() => {
      this.dialog()?.nativeElement.close();
    });
  }

  openVerification(): void {
    if (this.isEnabled() || this.isBusy()) return;
    this.errorMessage.set('');
    this.isOpen.set(true);
  }

  closeVerification(): void {
    if (this.isBusy()) return;
    this.dialog()?.nativeElement.close();
    this.isOpen.set(false);
  }

  onDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeVerification();
  }

  onBack(): void {
    if (this.isBusy()) return;
    this.errorMessage.set('');
    if (this.step() === 'complete') {
      this.closeVerification();
    } else if (this.step() === 'verify') {
      this.otpDigits.set(this.otpPositions.map(() => ''));
      this.step.set('setup');
    } else {
      this.step.set('preparation');
    }
  }

  async enableGoogleAuth(): Promise<void> {
    if (this.isBusy() || this.isEnabled()) return;
    if (this.qrPath()) {
      this.step.set('setup');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    const completeTask = this.pendingTasks.add();
    try {
      const result = await totpSetup();
      if (this.destroyRef.destroyed) return;
      if (
        result?.result !== true ||
        !result.data?.qrCodeUrl ||
        !Array.isArray(result.data.backupCodes)
      ) {
        throw new Error(
          result?.message || 'Unable to setup Google Authenticator. Please try again.',
        );
      }
      this.qrPath.set(result.data.qrCodeUrl);
      this.backupCodes.set(result.data.backupCodes);
      this.step.set('setup');
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to setup Google Authenticator.',
        );
      }
    } finally {
      this.isSubmitting.set(false);
      completeTask();
    }
  }

  nextStep(): void {
    if (!this.qrPath() || this.isBusy() || this.isEnabled()) return;
    this.errorMessage.set('');
    this.step.set('verify');
  }

  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fillOtp(index, input.value);
    input.value = this.otpDigits()[index];
  }

  onOtpPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    this.fillOtp(index, event.clipboardData?.getData('text') ?? '');
  }

  onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (this.isBusy()) return;
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
      event.preventDefault();
      const digits = [...this.otpDigits()];
      digits[index - 1] = '';
      this.otpDigits.set(digits);
      this.otpInputs()[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.otpInputs()[index + (event.key === 'ArrowLeft' ? -1 : 1)]?.nativeElement.focus();
    }
  }

  private fillOtp(index: number, value: string): void {
    if (this.isBusy() || this.isEnabled()) return;
    const text = value.replace(/\D/g, '');
    const start = text.length >= 6 ? 0 : index;
    const digits = [...this.otpDigits()];
    digits[index] = '';
    Array.from(text.slice(0, 6 - start)).forEach((digit, offset) => {
      digits[start + offset] = digit;
    });
    this.otpDigits.set(digits);
    this.errorMessage.set('');
    if (text.length) {
      this.otpInputs()[Math.min(start + text.length, 5)]?.nativeElement.focus();
    }
  }

  onVerifySubmit(event: Event): void {
    event.preventDefault();
    void this.verifySetup();
  }

  async verifySetup(): Promise<void> {
    if (!this.canVerify()) return;
    this.isVerifying.set(true);
    this.errorMessage.set('');
    const completeTask = this.pendingTasks.add();
    try {
      const result = await totpVerifySetup({ token: this.verifyToken() });
      if (this.destroyRef.destroyed) return;
      if (result?.result !== true) {
        throw new Error(
          result?.message || 'Unable to verify Google Authenticator. Please try again.',
        );
      }
      this.require2fa.set(true);
      this.step.set('complete');
      this.qrPath.set('');
      this.backupCodes.set([]);
      this.otpDigits.set(this.otpPositions.map(() => ''));
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'Unable to verify Google Authenticator. Please try again.',
        );
      }
    } finally {
      this.isVerifying.set(false);
      completeTask();
    }
  }

  async copyLink(): Promise<void> {
    if (!this.qrPath()) return;
    try {
      await navigator.clipboard.writeText(this.qrPath());
      this.copyMessage.set('Link copied.');
    } catch {
      this.copyMessage.set('Unable to copy. Please select and copy the link above.');
    }
  }

  downloadBackupCodes(): void {
    if (!this.backupCodes().length) return;
    const blob = new Blob([this.backupCodes().join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'backup-codes.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
