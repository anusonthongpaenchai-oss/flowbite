import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  PendingTasks,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { getKyc, type KycResponse } from '../../../shared/api/kyc/getKyc';
import {
  imgVerify,
  kycIdTypes,
  kycImageError,
  type KycIdType,
} from '../../../shared/api/kyc/imgVerify';
import { emailVerify, smsVerify } from '../../../shared/api/kyc/otpVerify';
import { sendEmail, sendSms } from '../../../shared/api/kyc/sendOtp';
import {
  normalizeProfileUpdateRequest,
  profileFieldError,
  profileUpdate,
  type ProfileField,
} from '../../../shared/api/userInfo/profileUpdate';
import { getUserInfo } from '../../../shared/api/userInfo/userInfo';
import { InputComponent } from '../../components/input/input';
import { Button } from '../../components/button/button';
import { Verify as VerifyStatus } from '../../components/verify/verify';

type VerifyStep = 'profile' | 'otp' | 'id-proof';
type OtpMethod = 'sms' | 'email';

function profileValidator(field: ProfileField): ValidatorFn {
  return (control) => {
    const message = profileFieldError(field, control.value);
    return message ? { profile: message } : null;
  };
}

@Component({
  imports: [InputComponent, Button, ReactiveFormsModule, VerifyStatus],
  selector: 'app-verify',
  styleUrl: './verify.css',
  templateUrl: './verify.html',
})
export class Verify implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly verificationDialog =
    viewChild<ElementRef<HTMLDialogElement>>('verificationDialog');
  private readonly otpInputs = viewChildren<ElementRef<HTMLInputElement>>('otpDigit');
  private readonly otpRequest = signal<{ method: OtpMethod; memberRef: string } | null>(null);

  public readonly kycDetail = signal<KycResponse | null>(null);
  public readonly step = signal<VerifyStep>('profile');
  public readonly hasStarted = signal(false);
  public readonly isVerificationOpen = signal(false);
  public readonly otpVerified = signal(false);
  public readonly isDraggingImage = signal(false);
  public readonly otpPositions = [0, 1, 2, 3, 4, 5];
  public readonly canVerify = computed(() => {
    const status = this.kycDetail()?.data.kyc_stat;
    return status === 3 || status === 2;
  });
  public readonly statusVariant = computed(() => {
    const status = this.kycDetail()?.data.kyc_stat;
    return status === 0 ? 'pending' : status === 1 ? 'approve' : status === 2 ? 'reject' : 'None';
  });
  public readonly isRejected = computed(() => this.kycDetail()?.data.kyc_stat === 2);
  public readonly hasInitialLoadError = computed(
    () =>
      (!this.kycDetail() && !!this.errorMessage()) ||
      (this.kycDetail()?.data.kyc_stat === 3 && !this.profileLoaded() && !!this.errorMessage()),
  );
  public readonly stepIndex = computed(() =>
    this.step() === 'profile' ? 1 : this.step() === 'otp' ? 2 : 3,
  );
  public readonly preparationItems = [
    'It takes about 10 - 15 minutes',
    'Receive your OTP via SMS or email',
    'Prepare a photo of your ID card or Passport',
  ];
  public readonly isLoading = signal(false);
  public readonly isSaving = signal(false);
  public readonly isSendingOtp = signal(false);
  public readonly isVerifyingOtp = signal(false);
  public readonly isUploadingImage = signal(false);
  public readonly isBusy = computed(
    () =>
      this.isLoading() ||
      this.isSaving() ||
      this.isSendingOtp() ||
      this.isVerifyingOtp() ||
      this.isUploadingImage(),
  );
  public readonly errorMessage = signal('');
  public readonly profileLoaded = signal(false);
  public readonly selectedIdFile = signal<File | null>(null);
  public readonly idImagePreview = signal('');
  public readonly kycIdTypes = kycIdTypes;

  public readonly m_phone_code = signal('');

  public readonly profileForm = this.fb.nonNullable.group({
    member: this.fb.nonNullable.group({
      m_name: this.field('m_name'),
      m_lastname: this.field('m_lastname'),
      m_gender: this.field('m_gender'),
      m_country: this.field('m_country'),
      m_phone: this.field('m_phone'),
      m_birthdate: this.field('m_birthdate'),
    }),
    address: this.fb.nonNullable.group({
      address_no: this.field('address_no'),
      address_district: this.field('address_district'),
      address_city: this.field('address_city'),
      address_state: this.field('address_state'),
      address_zipcode: this.field('address_zipcode'),
    }),
  });

  public readonly otpForm = this.fb.nonNullable.group({
    otpMethod: this.fb.nonNullable.control<OtpMethod>('sms'),
    otpCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    digits: this.fb.nonNullable.array(
      this.otpPositions.map(() => this.fb.nonNullable.control('', Validators.pattern(/^\d?$/))),
    ),
  });
  public readonly otpMethod = toSignal(this.otpForm.controls.otpMethod.valueChanges, {
    initialValue: this.otpForm.controls.otpMethod.value,
  });
  public readonly otpDigits = toSignal(
    this.otpForm.controls.digits.valueChanges.pipe(
      map(() => this.otpForm.controls.digits.getRawValue()),
    ),
    { initialValue: this.otpForm.controls.digits.getRawValue() },
  );
  public readonly otpSent = computed(() => this.otpRequest()?.method === this.otpMethod());

  public readonly imageForm = this.fb.nonNullable.group({
    kycIdType: this.fb.nonNullable.control<KycIdType | ''>('', Validators.required),
  });
  public readonly selectedIdType = toSignal(this.imageForm.controls.kycIdType.valueChanges, {
    initialValue: this.imageForm.controls.kycIdType.value,
  });
  public readonly isPassportSample = computed(() => this.selectedIdType() === 'Passport');
  public readonly sampleDocumentImage = computed(() =>
    this.isPassportSample()
      ? 'svg/kyc/stamp-passport-traveling-open-passport-international-arrival-visa-stamps-vector-set 1.svg'
      : 'svg/kyc/thai-id-card-vector-design-infographic-works 1.svg',
  );

  constructor() {
    const { otpCode, digits } = this.otpForm.controls;
    let synchronizingDigits = false;
    otpCode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((code) => {
      if (code !== digits.getRawValue().join('')) {
        synchronizingDigits = true;
        try {
          digits.setValue(this.otpPositions.map((index) => code.charAt(index)));
        } finally {
          synchronizingDigits = false;
        }
      }
    });
    digits.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const code = digits.getRawValue().join('');
      if (!synchronizingDigits && code !== otpCode.value) {
        otpCode.setValue(code, { emitEvent: false });
      }
    });
    afterRenderEffect(() => {
      const dialog = this.verificationDialog()?.nativeElement;
      if (dialog && this.isVerificationOpen() && !dialog.open) {
        dialog.showModal();
      }
      if (
        this.isVerificationOpen() &&
        this.hasStarted() &&
        this.step() === 'otp' &&
        !this.isBusy() &&
        !this.otpVerified()
      ) {
        this.otpInputs()[0]?.nativeElement.focus();
      }
    });
    this.destroyRef.onDestroy(() => {
      const dialog = this.verificationDialog()?.nativeElement;
      if (dialog?.open) {
        dialog.close();
      }
    });
  }

  ngOnInit(): void {
    void this.loadKyc();
  }

  public openVerification(): void {
    if (this.isBusy() || !this.canVerify()) {
      return;
    }
    if (this.isRejected()) {
      this.step.set('id-proof');
      this.hasStarted.set(true);
      this.isVerificationOpen.set(true);
      return;
    }
    if (this.profileLoaded()) {
      this.isVerificationOpen.set(true);
    }
  }

  public startVerification(): void {
    if (this.isBusy() || !this.canVerify()) {
      return;
    }
    if (this.isRejected()) {
      this.step.set('id-proof');
      this.hasStarted.set(true);
      this.isVerificationOpen.set(true);
      return;
    }
    if (this.profileLoaded()) {
      this.hasStarted.set(true);
      this.isVerificationOpen.set(true);
    }
  }

  public closeVerification(): void {
    if (this.isBusy()) {
      return;
    }
    this.verificationDialog()?.nativeElement.close();
    this.isVerificationOpen.set(false);
  }

  public onDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeVerification();
  }

  public onBack(): void {
    if (this.isBusy()) {
      return;
    }
    if (this.isRejected()) {
      this.closeVerification();
      return;
    }
    this.errorMessage.set('');
    if (this.step() === 'profile') {
      this.hasStarted.set(false);
    } else if (this.step() === 'otp') {
      this.step.set('profile');
      this.otpRequest.set(null);
      this.otpVerified.set(false);
      this.resetOtpCode();
    } else {
      this.step.set(this.m_phone_code() === '+66' ? 'otp' : 'profile');
    }
  }

  public onOtpInput(index: number, event: Event): void {
    this.fillOtp(index, (event.target as HTMLInputElement).value);
  }

  public onOtpPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    this.fillOtp(index, event.clipboardData?.getData('text') ?? '');
  }

  public onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (this.isBusy() || this.otpVerified()) {
      return;
    }
    const controls = this.otpForm.controls.digits;
    if (event.key === 'Backspace' && !controls.at(index).value && index > 0) {
      event.preventDefault();
      const digits = controls.getRawValue();
      digits[index - 1] = '';
      controls.setValue(digits);
      this.otpInputs()[index - 1]?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.otpInputs()[index + (event.key === 'ArrowLeft' ? -1 : 1)]?.nativeElement.focus();
    }
  }

  private fillOtp(index: number, value: string): void {
    if (this.isBusy() || this.otpVerified()) {
      return;
    }
    const text = value.replace(/\D/g, '');
    const start = text.length >= 6 ? 0 : index;
    const controls = this.otpForm.controls.digits;
    const digits = controls.getRawValue();
    digits[index] = '';
    Array.from(text)
      .slice(0, 6 - start)
      .forEach((digit, offset) => (digits[start + offset] = digit));
    controls.setValue(digits);
    if (text.length) {
      this.otpInputs()[Math.min(start + text.length, 5)]?.nativeElement.focus();
    }
  }

  private resetOtpCode(): void {
    this.otpForm.reset({
      otpMethod: this.otpForm.controls.otpMethod.value,
      otpCode: '',
      digits: this.otpPositions.map(() => ''),
    });
  }

  private field(field: ProfileField) {
    const validators = [profileValidator(field)];
    if (field === 'm_birthdate') {
      validators.push(Validators.required);
    }
    return this.fb.nonNullable.control('', validators);
  }

  public fieldError(field: ProfileField): string {
    const control =
      this.profileForm.controls.member.get(field) ?? this.profileForm.controls.address.get(field);
    if (!control || (!control.touched && !control.dirty)) {
      return '';
    }
    if (field === 'm_birthdate' && control.hasError('required')) {
      return 'Date of birth is required.';
    }
    return control.getError('profile') ?? '';
  }

  public otpError(): string {
    const control = this.otpForm.controls.otpCode;
    return (control.touched || control.dirty) && control.invalid ? 'Enter the 6-digit OTP.' : '';
  }

  public setOtpMethod(method: string): void {
    if (
      this.isBusy() ||
      this.isRejected() ||
      !this.profileLoaded() ||
      this.m_phone_code() !== '+66' ||
      this.step() === 'id-proof' ||
      (method !== 'sms' && method !== 'email') ||
      method === this.otpMethod()
    ) {
      return;
    }
    this.otpForm.controls.otpMethod.setValue(method);
    this.otpRequest.set(null);
    this.otpVerified.set(false);
    this.resetOtpCode();
    this.errorMessage.set('');
  }

  public async loadKyc(): Promise<void> {
    if (this.isBusy()) {
      return;
    }
    await this.refreshKyc();
  }

  private async refreshKyc(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.kycDetail.set(null);
    this.profileLoaded.set(false);
    this.step.set('profile');
    this.hasStarted.set(false);
    this.isVerificationOpen.set(false);
    this.otpRequest.set(null);
    this.otpVerified.set(false);
    this.otpForm.reset();
    this.imageForm.reset();
    this.selectedIdFile.set(null);
    this.idImagePreview.set('');
    const completeTask = this.pendingTasks.add();

    try {
      const response = await getKyc();
      if (this.destroyRef.destroyed) {
        return;
      }
      if (!response?.data?.result || !response.data.data) {
        throw new Error(response?.data?.message || 'Failed to load KYC. Please try again.');
      }
      this.kycDetail.set(response.data);
      if (this.canVerify() && response.data.data.kyc_stat !== 2) {
        await this.loadUserInfo();
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(error instanceof Error ? error.message : 'Failed to load KYC.');
      }
    } finally {
      this.isLoading.set(false);
      completeTask();
    }
  }

  private async loadUserInfo(): Promise<void> {
    const response = await getUserInfo();
    if (this.destroyRef.destroyed) {
      return;
    }
    if (!response?.result || !response.data?.member) {
      throw new Error(response?.message || 'Unable to load your profile. Please try again.');
    }

    const { member, address } = response.data;
    this.m_phone_code.set(member.m_phone_code ?? '');

    this.profileForm.reset({
      member: {
        m_name: member.m_name ?? '',
        m_lastname: member.m_lastname ?? '',
        m_gender: member.m_gender ?? '',
        m_country: member.m_country ?? '',
        m_phone: member.m_phone ?? '',
        m_birthdate: member.m_birthdate?.slice(0, 10) ?? '',
      },
      address: {
        address_no: address?.address_no ?? '',
        address_district: address?.address_district ?? '',
        address_city: address?.address_city ?? '',
        address_state: address?.address_state ?? '',
        address_zipcode: address?.address_zipcode ?? '',
      },
    });
    this.profileLoaded.set(true);
  }

  public async onUpdateProfile(): Promise<void> {
    if (
      this.isBusy() ||
      this.isRejected() ||
      !this.profileLoaded() ||
      this.step() !== 'profile' ||
      !this.canVerify()
    ) {
      return;
    }
    this.errorMessage.set('');
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      this.errorMessage.set('Please complete all required profile fields.');
      return;
    }

    this.isSaving.set(true);
    this.profileForm.disable();
    const completeTask = this.pendingTasks.add();
    try {
      const { member, address } = this.profileForm.getRawValue();
      await profileUpdate(normalizeProfileUpdateRequest({ member, address }));
      if (!this.destroyRef.destroyed) {
        this.step.set(this.m_phone_code() === '+66' ? 'otp' : 'id-proof');
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'Unable to update your profile. Please try again.',
        );
      }
    } finally {
      this.isSaving.set(false);
      this.profileForm.enable();
      completeTask();
    }

    if (!this.destroyRef.destroyed && this.step() === 'otp') {
      await this.sendOtp();
    }
  }

  public async sendOtp(): Promise<void> {
    if (
      this.isBusy() ||
      this.isRejected() ||
      this.step() !== 'otp' ||
      this.m_phone_code() !== '+66'
    ) {
      return;
    }
    this.isSendingOtp.set(true);
    this.errorMessage.set('');
    this.otpVerified.set(false);
    this.otpRequest.set(null);
    this.resetOtpCode();
    this.otpForm.disable();
    const { otpMethod: method } = this.otpForm.getRawValue();
    const completeTask = this.pendingTasks.add();
    try {
      const response = await (method === 'sms' ? sendSms() : sendEmail());
      const memberRef = response?.data?.memberRef;
      if (typeof memberRef !== 'string' || !memberRef.trim()) {
        throw new Error('The server did not return an OTP reference. Please try again.');
      }
      if (!this.destroyRef.destroyed) {
        this.otpRequest.set({ method, memberRef });
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Failed to send OTP. Please try again.',
        );
      }
    } finally {
      this.isSendingOtp.set(false);
      this.otpForm.enable();
      completeTask();
    }
  }

  public async onVerifyOtp(): Promise<void> {
    if (this.isRejected()) {
      return;
    }
    const request = this.otpRequest();
    if (this.isBusy() || this.step() !== 'otp' || !request || !this.otpSent()) {
      return;
    }
    if (this.otpVerified()) {
      this.step.set('id-proof');
      return;
    }
    this.errorMessage.set('');
    this.otpForm.markAllAsTouched();
    if (this.otpForm.invalid) {
      return;
    }

    this.isVerifyingOtp.set(true);
    this.otpForm.disable();
    const completeTask = this.pendingTasks.add();
    try {
      const verify = request.method === 'sms' ? smsVerify : emailVerify;
      await verify({
        memberRef: request.memberRef,
        otpCode: this.otpForm.getRawValue().otpCode,
        optional: 'KYC',
      });
      if (!this.destroyRef.destroyed) {
        this.otpVerified.set(true);
        this.step.set('id-proof');
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Failed to verify OTP. Please try again.',
        );
      }
    } finally {
      this.isVerifyingOtp.set(false);
      this.otpForm.enable();
      completeTask();
    }
  }

  public onIdImageSelected(event: Event): void {
    if (this.isBusy() || this.step() !== 'id-proof') {
      return;
    }
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.selectIdImage(file);
  }

  public onIdImageDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isBusy()) {
      this.isDraggingImage.set(true);
    }
  }

  public onIdImageDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingImage.set(false);
    if (!this.isBusy() && this.step() === 'id-proof') {
      this.selectIdImage(event.dataTransfer?.files?.[0]);
    }
  }

  public onImagePickerKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (!this.isBusy()) {
        input.click();
      }
    }
  }

  private selectIdImage(file: File | undefined): void {
    if (!file) {
      return;
    }

    const message = kycImageError(file);
    this.errorMessage.set(message);
    this.selectedIdFile.set(null);
    this.idImagePreview.set('');
    if (message) {
      return;
    }

    this.selectedIdFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (!this.destroyRef.destroyed && this.selectedIdFile() === file) {
        this.idImagePreview.set(reader.result as string);
      }
    };
    reader.onerror = () => {
      if (!this.destroyRef.destroyed && this.selectedIdFile() === file) {
        this.selectedIdFile.set(null);
        this.errorMessage.set('Unable to preview this image. Please select another image.');
      }
    };
    reader.readAsDataURL(file);
  }

  public removeIdImage(): void {
    if (this.isBusy()) {
      return;
    }
    this.selectedIdFile.set(null);
    this.idImagePreview.set('');
    this.errorMessage.set('');
  }

  public async onSubmitImage(): Promise<void> {
    if (
      this.isBusy() ||
      this.step() !== 'id-proof' ||
      !this.canVerify() ||
      (!this.isRejected() && !this.profileLoaded())
    ) {
      return;
    }
    this.errorMessage.set('');
    this.imageForm.markAllAsTouched();
    const kycIdType = this.imageForm.controls.kycIdType.value;
    if (this.imageForm.invalid || !kycIdType) {
      this.errorMessage.set('Please select your ID type.');
      return;
    }
    const file = this.selectedIdFile();
    const message = kycImageError(file);
    if (!file || message) {
      this.errorMessage.set(message);
      return;
    }

    this.isUploadingImage.set(true);
    this.imageForm.disable();
    const completeTask = this.pendingTasks.add();
    try {
      await imgVerify({ kycImage: file, kycIdType });
      if (!this.destroyRef.destroyed) {
        this.selectedIdFile.set(null);
        this.idImagePreview.set('');
        let navigationFailed = false;
        try {
          await this.router.navigateByUrl('/user/verify', { replaceUrl: true });
        } catch {
          navigationFailed = true;
        }
        if (!this.destroyRef.destroyed) {
          await this.refreshKyc();
          if (navigationFailed && !this.errorMessage()) {
            this.errorMessage.set(
              'KYC image submitted successfully, but unable to open the verification page. Please try again.',
            );
          }
        }
      }
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to submit KYC. Please try again.',
        );
      }
    } finally {
      this.isUploadingImage.set(false);
      this.imageForm.enable();
      completeTask();
    }
  }
}
