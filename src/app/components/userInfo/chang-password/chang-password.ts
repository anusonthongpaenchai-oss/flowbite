import {
  afterRenderEffect,
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  output,
  PendingTasks,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  changPassword,
  sendEmail,
  sendSms,
  type RequestChangPassword,
} from '../../../../shared/api/userInfo/changPassword';
import { InputComponent } from '../../input/input';
import { Button } from '../../button/button';

@Component({
  imports: [InputComponent, Button, ReactiveFormsModule],
  selector: 'app-chang-password',
  host: { class: 'contents' },
  templateUrl: './chang-password.html',
})
export class ChangPassword implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('passwordDialog');
  private readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpDigit');
  private memberRef = '';

  readonly closed = output<void>();
  readonly passwordChanged = output<void>();
  readonly otpSent = signal(false);
  readonly isSending = signal(false);
  readonly isSaving = signal(false);
  readonly isBusy = computed(() => this.isSending() || this.isSaving());
  readonly errorMessage = signal('');
  readonly otpPositions = [0, 1, 2, 3, 4, 5];

  public leftIcon: string = 'svg/icon/Vector.svg';

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      otpMethod: this.fb.nonNullable.control<RequestChangPassword['otpMethod']>('sms'),
      otpCode: '',
    },
    {
      validators: (form) => {
        const currentPassword = form.get('currentPassword')?.value;
        const newPassword = form.get('newPassword')?.value;
        const confirmPassword = form.get('confirmPassword')?.value;
        const errors = {
          ...(currentPassword === newPassword || currentPassword === confirmPassword
            ? { passwordReuse: true }
            : {}),
          ...(newPassword !== confirmPassword ? { passwordMismatch: true } : {}),
        };

        return Object.keys(errors).length ? errors : null;
      },
    },
  );

  passwordError(field: 'newPassword' | 'confirmPassword'): string {
    const control = this.passwordForm.controls[field];
    if (!control.touched && !control.dirty) {
      return '';
    }
    if (
      this.passwordForm.hasError('passwordReuse') &&
      control.value === this.passwordForm.controls.currentPassword.value
    ) {
      return field === 'newPassword'
        ? 'New password must be different from your old password.'
        : 'Confirm password must be different from your old password.';
    }
    if (field === 'confirmPassword' && this.passwordForm.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }
    return '';
  }

  constructor() {
    afterRenderEffect(() => {
      if (this.otpSent()) {
        this.otpInputs()[0]?.nativeElement.focus();
      }
    });
  }

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    if (this.dialog().nativeElement.open) {
      this.dialog().nativeElement.close();
    }
  }

  close(): void {
    if (!this.isBusy()) {
      this.dialog().nativeElement.close();
      this.closed.emit();
    }
  }

  onBack(): void {
    if (this.isBusy()) {
      return;
    }
    if (!this.otpSent()) {
      this.close();
      return;
    }

    this.otpSent.set(false);
    this.memberRef = '';
    this.errorMessage.set('');
    this.passwordForm.controls.otpCode.setValue('');
    this.passwordForm.enable();
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) {
      return;
    }
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.close();
    }
  }

  onOtpInput(index: number, event: Event): void {
    this.fillOtp(index, (event.target as HTMLInputElement).value);
  }

  onOtpPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    if (!this.isBusy()) {
      this.fillOtp(index, event.clipboardData?.getData('text') ?? '');
    }
  }

  onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (this.isBusy()) {
      return;
    }
    const inputs = this.otpInputs();
    if (event.key === 'Backspace' && !inputs[index].nativeElement.value && index > 0) {
      event.preventDefault();
      inputs[index - 1].nativeElement.value = '';
      this.updateOtpCode();
      inputs[index - 1].nativeElement.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = index + (event.key === 'ArrowLeft' ? -1 : 1);
      inputs[next]?.nativeElement.focus();
    }
  }

  private fillOtp(index: number, value: string): void {
    if (this.isBusy()) {
      return;
    }
    const inputs = this.otpInputs();
    const start = value.length >= inputs.length ? 0 : index;
    const characters = Array.from(value).slice(0, inputs.length - start);
    inputs[index].nativeElement.value = '';
    characters.forEach((character, offset) => {
      inputs[start + offset].nativeElement.value = character;
    });
    this.updateOtpCode();
    if (characters.length) {
      inputs[Math.min(start + characters.length, inputs.length - 1)].nativeElement.focus();
    }
  }

  private updateOtpCode(): void {
    this.passwordForm.controls.otpCode.setValue(
      this.otpInputs()
        .map((input) => input.nativeElement.value)
        .join(''),
    );
  }

  async onNext(): Promise<void> {
    if (this.isBusy() || this.otpSent()) {
      return;
    }

    this.errorMessage.set('');
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      return;
    }

    this.isSending.set(true);
    this.passwordForm.disable();
    const completeTask = this.pendingTasks.add();

    try {
      const { otpMethod } = this.passwordForm.getRawValue();
      const response = await (otpMethod === 'sms' ? sendSms() : sendEmail());
      if (!this.destroyRef.destroyed) {
        this.memberRef = response.data.memberRef;
        this.otpSent.set(true);
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to send OTP. Please try again.',
      );
    } finally {
      this.isSending.set(false);
      if (this.otpSent()) {
        this.passwordForm.controls.otpCode.enable();
      } else {
        this.passwordForm.enable();
      }
      completeTask();
    }
  }

  async onSave(): Promise<void> {
    if (this.isBusy() || !this.otpSent() || this.passwordForm.invalid) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.passwordForm.disable();
    const completeTask = this.pendingTasks.add();

    try {
      await changPassword({
        ...this.passwordForm.getRawValue(),
        memberRef: this.memberRef,
        token: '',
      });
      if (!this.destroyRef.destroyed) {
        this.passwordChanged.emit();
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to change password. Please try again.',
      );
    } finally {
      this.isSaving.set(false);
      this.passwordForm.controls.otpCode.enable();
      completeTask();
    }
  }
}
