import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { Button } from '../../components/ui/button/button';
import { InputComponent } from '../../components/ui/input/input';
import { forgotPassword } from '../../../shared/api/auth/forgotPassword';

@Component({
  imports: [Navbar, Button, InputComponent, ReactiveFormsModule],
  selector: 'app-forgot-password',
  host: { class: 'block' },
  styleUrl: './forgot-password.css',
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private redirectTimer: ReturnType<typeof setTimeout> | undefined;

  readonly illustration = 'svg/forgotPassword/Illustration.svg';
  readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly isBusy = computed(() => this.isSubmitting() || !!this.successMessage());

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.redirectTimer);
    });
  }

  emailError(): string {
    const email = this.forgotPasswordForm.controls.email;

    if (!email.touched) {
      return '';
    }

    if (email.hasError('required')) {
      return 'Please enter your email address.';
    }

    return email.hasError('email') ? 'Please enter a valid email address.' : '';
  }

  public async onSubmit(): Promise<void> {
    if (this.isBusy() || this.destroyRef.destroyed) {
      return;
    }

    this.errorMessage.set('');
    const email = this.forgotPasswordForm.controls.email.value.trim();
    this.forgotPasswordForm.controls.email.setValue(email);

    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    try {
      const response = await forgotPassword({ email });

      if (this.destroyRef.destroyed) {
        return;
      }

      this.successMessage.set(
        response.message.trim() || 'Password reset instructions sent. Please check your email.',
      );
      this.redirectTimer = setTimeout(() => {
        void this.router.navigateByUrl('/', { replaceUrl: true });
      }, 2000);
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'Unable to request a password reset. Please try again.',
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.isSubmitting.set(false);
      }
    }
  }
}
