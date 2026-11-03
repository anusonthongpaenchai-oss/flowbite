import { Component, inject, signal } from '@angular/core';
import { Button } from '../../components/button/button';
import { Checkbox } from '../../components/checkbox/checkbox';
import { InputComponent } from '../../components/input/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';
import { login } from '../../../shared/api/auth/login';

@Component({
  imports: [Button, Checkbox, InputComponent, ReactiveFormsModule, Navbar],
  selector: 'app-login',
  host: { class: 'block' },
  templateUrl: './login.html',
})
export class Login {

  private readonly fb = inject(FormBuilder);

  // svg
  readonly logo = 'svg/Logo.svg';
  readonly illustration = 'svg/login/Illustration.svg';
  readonly facebookIcon = 'svg/social/Facebook.svg';
  readonly googleIcon = 'svg/social/Google.svg';

  // signal
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  // form builder
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

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

    if (this.isSubmitting()) {
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

    try {
      const response = await login({
        usernameOrEmail: this.email.trim(),
        password: this.password,
      });
      const session = response.data;

      if (session?.require2FA) {
        this.errorMessage.set('Two-factor authentication is required to complete sign-in.');
        return;
      }

      if (!session?.accessToken || !session.refreshToken || !session.member) {
        this.errorMessage.set(response.message || 'Unable to sign in. Please try again.');
        return;
      }

      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      storage.setItem('authSession', JSON.stringify(session));
      otherStorage.removeItem('authSession');

      this.password = '';
      this.loginForm.controls.password.markAsUntouched();
      this.successMessage.set(response?.message);

      console.log(`accessToken: ${session.accessToken}`);
      console.log(`refreshToken: ${session.refreshToken}`);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
