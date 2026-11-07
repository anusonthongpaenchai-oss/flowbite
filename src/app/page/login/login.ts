import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  PendingTasks,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../components/ui/button/button';
import { Checkbox } from '../../components/ui/checkbox/checkbox';
import { InputComponent } from '../../components/ui/input/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { login, type LoginData } from '../../../shared/api/auth/login';
import { twoFaVerify } from '../../../shared/api/2fa/twoFaVerify';
import { setAuthSession } from '../../../shared/guard/auth';
import { startTokenRefresh } from '../../../shared/services/tokenRefreshScheduler';

@Component({
  imports: [Button, Checkbox, InputComponent, ReactiveFormsModule, Navbar],
  selector: 'app-login',
  host: { class: 'block' },
  templateUrl: './login.html',
})
export class Login implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly otpDialog = viewChild<ElementRef<HTMLDialogElement>>('otpDialog');
  private readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpDigit');
  private pendingRememberMe = false;

  // svg
  readonly logo = 'svg/Logo.svg';
  readonly illustration = 'svg/login/Illustration.svg';
  readonly facebookIcon = 'svg/social/Facebook.svg';
  readonly googleIcon = 'svg/social/Google.svg';

  // signal
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly preAuthToken = signal('');
  readonly isVerifying = signal(false);
  readonly otpErrorMessage = signal('');
  readonly otpPositions = [0, 1, 2, 3, 4, 5];
  readonly otpDigits = signal(this.otpPositions.map(() => ''));

  // form builder
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  readonly otpForm = this.fb.nonNullable.group({
    totpToken: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
    rememberDevice: [false],
  });

  constructor() {
    this.otpForm.controls.totpToken.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => {
        if (token !== this.otpDigits().join('')) {
          this.otpDigits.set(this.otpPositions.map((position) => token.charAt(position)));
        }
      });
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
    if (this.isVerifying() || !this.preAuthToken()) return;
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
      event.preventDefault();
      const digits = [...this.otpDigits()];
      digits[index - 1] = '';
      this.setOtpDigits(digits);
      this.otpInputs()[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.otpInputs()[index + (event.key === 'ArrowLeft' ? -1 : 1)]?.nativeElement.focus();
    }
  }

  private fillOtp(index: number, value: string): void {
    if (this.isVerifying() || !this.preAuthToken()) return;
    const text = value.replace(/\D/g, '');
    const start = text.length >= 6 ? 0 : index;
    const digits = [...this.otpDigits()];
    digits[index] = '';
    Array.from(text.slice(0, 6 - start)).forEach((digit, offset) => {
      digits[start + offset] = digit;
    });
    this.setOtpDigits(digits);
    if (text.length) {
      this.otpInputs()[Math.min(start + text.length, 5)]?.nativeElement.focus();
    }
  }

  private setOtpDigits(digits: string[]): void {
    this.otpDigits.set(digits);
    this.otpForm.controls.totpToken.setValue(digits.join(''));
    this.otpForm.controls.totpToken.markAsDirty();
    this.otpErrorMessage.set('');
  }

  otpError(): string {
    const token = this.otpForm.controls.totpToken;
    return (
      this.otpErrorMessage() || (token.touched && token.invalid ? 'Enter a 6-digit code.' : '')
    );
  }

  ngOnDestroy(): void {
    this.clearTwoFaChallenge();
    this.password = '';
  }

  cancelTwoFa(event?: Event): void {
    event?.preventDefault();
    if (!this.isVerifying()) {
      this.clearTwoFaChallenge();
    }
  }

  private clearTwoFaChallenge(): void {
    this.preAuthToken.set('');
    this.pendingRememberMe = false;
    this.otpErrorMessage.set('');
    this.otpForm.enable();
    this.otpForm.reset({ totpToken: '', rememberDevice: false });
    this.otpDigits.set(this.otpPositions.map(() => ''));
    const dialog = this.otpDialog()?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
    this.loginForm.enable();
  }

  private async completeSignIn(
    session: LoginData,
    message: string,
    rememberMe: boolean,
    rememberDevice = false,
  ): Promise<void> {
    setAuthSession(
      {
        ...session,
        tokenExpiresAt: Date.now() + session.expiresIn * 1000,
        rememberDevice,
        // A completed challenge records the original login's require2FA: true.
        ...(this.preAuthToken() ? { twoFaEnabled: true } : {}),
      },
      rememberMe,
    );

    if (rememberMe) {
      startTokenRefresh();
    }

    this.clearTwoFaChallenge();
    this.password = '';
    this.loginForm.controls.password.markAsUntouched();
    this.successMessage.set(message);
    await this.router.navigateByUrl('/dashboard');
  }

  async verifyTwoFa(): Promise<void> {
    if (this.destroyRef.destroyed || this.isVerifying() || !this.preAuthToken()) {
      return;
    }

    this.otpErrorMessage.set('');
    this.otpForm.markAllAsTouched();
    if (this.otpForm.invalid) {
      const firstEmpty = this.otpDigits().findIndex((digit) => !digit);
      this.otpInputs()[Math.max(0, firstEmpty)]?.nativeElement.focus();
      return;
    }

    const body = { preAuthToken: this.preAuthToken(), ...this.otpForm.getRawValue() };
    const rememberMe = this.pendingRememberMe;
    this.isVerifying.set(true);
    this.otpForm.disable();
    const completeTask = this.pendingTasks.add();

    try {
      const response = await twoFaVerify(body);
      if (!this.destroyRef.destroyed) {
        await this.completeSignIn(response.data, response.message, rememberMe, body.rememberDevice);
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.otpErrorMessage.set(
          error instanceof Error ? error.message : 'Unable to verify your code. Please try again.',
        );
      }
    } finally {
      this.isVerifying.set(false);
      if (!this.destroyRef.destroyed) {
        this.otpForm.enable();
      }
      completeTask();
    }
  }

  // form model
  public get email(): string {
    return this.loginForm.get('email')?.value ?? '';
  }

  public set email(value: string) {
    this.loginForm.patchValue({ email: value });
  }

  public get password(): string {
    return this.loginForm.get('password')?.value ?? '';
  }

  public set password(value: string) {
    this.loginForm.patchValue({ password: value });
  }

  public get rememberMe(): boolean {
    return this.loginForm.get('rememberMe')?.value ?? false;
  }

  public set rememberMe(value: boolean) {
    this.loginForm.patchValue({ rememberMe: value });
  }

  // handle submit
  public async handleSubmit(event?: Event): Promise<void> {
    event?.preventDefault();

    if (
      this.destroyRef.destroyed ||
      this.isSubmitting() ||
      this.isVerifying() ||
      this.preAuthToken()
    ) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Please enter a valid email and password.');
      return;
    }

    const rememberMe = this.rememberMe;
    this.isSubmitting.set(true);
    this.loginForm.disable();
    const completeTask = this.pendingTasks.add();

    try {
      const response = await login({
        usernameOrEmail: this.email.trim(),
        password: this.password,
      });
      if (this.destroyRef.destroyed) {
        return;
      }
      const session = response.data;

      if (session?.require2FA === true) {
        if (typeof session.preAuthToken !== 'string' || !session.preAuthToken.trim()) {
          throw new Error('The server returned an invalid response. Please try again.');
        }
        this.pendingRememberMe = rememberMe;
        this.otpForm.reset({ totpToken: '', rememberDevice: false });
        this.otpErrorMessage.set('');
        this.preAuthToken.set(session.preAuthToken);
        this.otpDialog()?.nativeElement.showModal();
        this.otpInputs()[0]?.nativeElement.focus();
        return;
      }

      if (!session) {
        this.errorMessage.set(response.message || 'Unable to sign in. Please try again.');
        return;
      }

      await this.completeSignIn(session, response.message, rememberMe);
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to sign in. Please try again.',
        );
      }
    } finally {
      this.isSubmitting.set(false);
      if (!this.destroyRef.destroyed && !this.preAuthToken()) {
        this.loginForm.enable();
      }
      completeTask();
    }
  }
}
