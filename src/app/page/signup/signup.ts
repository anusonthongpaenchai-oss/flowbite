import { Component, inject, signal } from '@angular/core';
import { InputComponent } from '../../components/ui/input/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { signupUser } from '../../../shared/api/auth/signup';
import { Checkbox } from '../../components/ui/checkbox/checkbox';
import { Button } from '../../components/ui/button/button';
import { Navbar } from '../../components/navbar/navbar';
import { termAndCondition } from '../../../shared/documents/terms';

@Component({
  imports: [Navbar, Button, InputComponent, Checkbox, ReactiveFormsModule],
  selector: 'app-signup',
  styleUrl: './signup.css',
  templateUrl: './signup.html',
})
export class Signup {
  private readonly router = inject(Router);

  public termAndCondition = termAndCondition;
  readonly illustration = 'svg/singup/Illustration.svg';
  readonly logo = 'svg/Logo.svg';
  readonly countryFlag = 'svg/language/English.svg';
  readonly fixedPhoneCode = '+66';
  // form model
  readonly fb = inject(FormBuilder);

  readonly signupForm = this.fb.nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      country: ['', Validators.required],
      phoneCode: [this.fixedPhoneCode, Validators.required],
      phoneNumber: ['', Validators.required],
      referralCode: [''],
      saleCode: [''],
      terms: [false, Validators.requiredTrue],
    },
    {
      validators: (form) =>
        form.get('password')?.value === form.get('confirmPassword')?.value
          ? null
          : { passwordMismatch: true },
    },
  );

  // signal
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  private readonly pageIndex = signal(0);
  readonly page = this.pageIndex.asReadonly();

  public next(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.errorMessage.set('');
    const controls = this.signupForm.controls;
    const currentControls =
      this.page() === 0
        ? [controls.terms]
        : this.page() === 1
          ? [controls.firstName, controls.lastName, controls.country]
          : [];

    currentControls.forEach((control) => control.markAsTouched());
    if (currentControls.some((control) => control.invalid)) {
      this.errorMessage.set(
        this.page() === 0
          ? 'Please accept the terms and conditions to continue.'
          : 'Please complete your first name, last name, and country.',
      );
      return;
    }

    this.pageIndex.update((page) => Math.min(2, Math.max(0, page + 1)));
  }

  public async back(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.errorMessage.set('');
    const pg = this.page() - 1;

    if (pg < 0) {
      await this.router.navigateByUrl('/');
      return;
    }

    this.pageIndex.set(pg);
  }

  // form value
  public get firstName(): string {
    return this.signupForm.get('firstName')?.value ?? '';
  }

  public set firstName(value: string) {
    this.signupForm.get('firstName')?.setValue(value);
  }

  public get lastName() {
    return this.signupForm.get('lastName')?.value ?? '';
  }

  public set lastName(value: string) {
    this.signupForm.get('lastName')?.setValue(value);
  }

  public get email() {
    return this.signupForm.get('email')?.value ?? '';
  }

  public set email(value: string) {
    this.signupForm.get('email')?.setValue(value);
  }

  public get password() {
    return this.signupForm.get('password')?.value ?? '';
  }

  public set password(value: string) {
    this.signupForm.get('password')?.setValue(value);
  }

  public get confirmPassword(): string {
    return this.signupForm.get('confirmPassword')?.value ?? '';
  }

  public set confirmPassword(value: string) {
    this.signupForm.get('confirmPassword')?.setValue(value);
  }

  public get country(): string {
    return this.signupForm.get('country')?.value ?? '';
  }

  public set country(value: string) {
    this.signupForm.get('country')?.setValue(value);
  }

  public get phoneCode(): string {
    return this.fixedPhoneCode;
  }

  public set phoneCode(_value: string) {
    this.signupForm.controls.phoneCode.setValue(this.fixedPhoneCode);
  }

  public get phoneNumber(): string {
    return this.signupForm.get('phoneNumber')?.value ?? '';
  }

  public set phoneNumber(value: string) {
    this.signupForm.get('phoneNumber')?.setValue(value);
  }

  public get referralCode(): string {
    return this.signupForm.get('referralCode')?.value ?? '';
  }

  public set referralCode(value: string) {
    this.signupForm.get('referralCode')?.setValue(value);
  }

  public get saleCode(): string {
    return this.signupForm.get('saleCode')?.value ?? '';
  }

  public set saleCode(value: string) {
    this.signupForm.get('saleCode')?.setValue(value);
  }

  public get terms(): boolean {
    return this.signupForm.get('terms')?.value ?? false;
  }

  public set terms(value: boolean) {
    this.signupForm.get('terms')?.setValue(value);
  }

  public async handleSubmit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.signupForm.controls.phoneCode.setValue(this.fixedPhoneCode);

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage.set(
        this.signupForm.hasError('passwordMismatch')
          ? 'Passwords do not match.'
          : 'Please complete all required fields correctly and accept the terms.',
      );
      return;
    }
    this.isSubmitting.set(true);

    try {
      const response = await signupUser({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        password: this.password,
        confirmPassword: this.confirmPassword,
        country: this.country,
        phoneCode: this.phoneCode,
        phoneNumber: this.phoneNumber,
        referralCode: this.referralCode,
        saleCode: this.saleCode,
        terms: this.terms,
      });

      if (response.result === true) {
        this.successMessage.set(response.message);
        this.signupForm.reset();
        this.pageIndex.set(0);
      } else {
        this.errorMessage.set(response.message);
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to register. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
