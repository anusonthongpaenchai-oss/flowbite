import { Component, inject, signal, output, input, OnInit } from '@angular/core';
import { InputComponent } from '../../../ui/input/input';
import { ReactiveFormsModule, FormBuilder, Validators, type ValidatorFn } from '@angular/forms';
import { Button } from '../../../ui/button/button';
import {
  normalizeProfileUpdateRequest,
  profileFieldError,
  type ProfileField,
  type ProfileUpdateRequest,
} from '../../../../../shared/api/userInfo/profileUpdate';

function profileValidator(field: ProfileField): ValidatorFn {
  return (control) => {
    const message = profileFieldError(field, control.value);
    return message ? { profile: message } : null;
  };
}

function internationalPhone(code: string, phone: string): string {
  const number = phone.trim();
  if (!number) {
    return '';
  }
  return code + (code === '+66' || code === '+44' ? number.replace(/^0/, '') : number);
}

@Component({
  imports: [InputComponent, ReactiveFormsModule, Button],
  selector: 'app-edit-profile',
  styleUrl: './edit-profile.css',
  templateUrl: './edit-profile.html',
})
export class EditProfile implements OnInit {
  // svg
  public leftIcon = 'svg/icon/Vector.svg';
  private readonly fb = inject(FormBuilder);

  public backEdit = output<void>();
  public updateProfile = output<ProfileUpdateRequest>();
  public profile = input<ProfileUpdateRequest | null>(null);
  public email = input('');
  public phoneCode = input('');
  public isUpdating = input(false);
  public serverError = input('');
  public pg = signal<number>(0);
  public errorMessage = signal('');

  readonly genders = ['MALE', 'FEMALE', 'OTHER'];
  readonly countries = ['Thailand', 'United Kingdom', 'United States'];
  readonly phoneCodes = [
    { label: 'TH +66', value: '+66' },
    { label: 'UK +44', value: '+44' },
    { label: 'US +1', value: '+1' },
  ];

  public onBack(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isUpdating()) {
      return;
    }
    this.errorMessage.set('');

    if (this.pg() > 0) {
      this.pg.update((pg) => pg - 1);
      return;
    }

    this.pg.set(-1);
    this.backEdit.emit();
  }

  public onNext(): void {
    if (this.pg() !== 0 || this.isUpdating()) {
      return;
    }

    this.errorMessage.set('');
    const member = this.editProfileForm.controls.member;
    member.markAllAsTouched();

    if (member.invalid) {
      this.errorMessage.set('Please complete all required profile fields.');
      return;
    }

    this.pg.set(1);
  }

  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isUpdating()) {
      this.backEdit.emit();
    }
  }

  private field(field: ProfileField, required = true) {
    return this.fb.nonNullable.control(
      '',
      required ? [Validators.required, profileValidator(field)] : [profileValidator(field)],
    );
  }

  public editProfileForm = this.fb.nonNullable.group({
    member: this.fb.nonNullable.group(
      {
        m_name: this.field('m_name'),
        m_lastname: this.field('m_lastname'),
        m_phone: this.fb.nonNullable.control(''),
        m_gender: this.field('m_gender', false),
        m_country: this.field('m_country'),
        phoneCode: this.fb.nonNullable.control('', Validators.required),
      },
      {
        validators: (group) => {
          const { phoneCode, m_phone } = group.getRawValue();
          const error = profileFieldError('m_phone', internationalPhone(phoneCode, m_phone));
          return error ? { phone: error } : null;
        },
      },
    ),
    address: this.fb.group({
      address: this.fb.group({
        address_no: this.field('address_no'),
        address_district: this.field('address_district'),
        address_city: this.field('address_city'),
        address_state: this.field('address_state'),
        address_zipcode: this.field('address_zipcode'),
      }),
    }),
  });

  ngOnInit(): void {
    const profile = this.profile();
    const phone = profile?.member.m_phone.trim() ?? '';
    const storedCode = this.phoneCode().trim().replace(/^\+/, '');
    const internationalCode = this.phoneCodes.find(({ value }) => phone.startsWith(value))?.value;
    const code =
      this.phoneCodes.find(({ value }) => value.slice(1) === storedCode)?.value ??
      internationalCode ??
      '';
    if (!profile) {
      this.editProfileForm.controls.member.controls.phoneCode.setValue(code);
      return;
    }

    const { member, address } = profile;
    const gender = member.m_gender.trim().toUpperCase();
    const country = member.m_country.trim().toLowerCase();
    const prefix = internationalCode ?? code.slice(1);
    const hasPrefix =
      prefix && phone.startsWith(prefix) && (internationalCode || phone.length > 10);
    this.editProfileForm.setValue({
      member: {
        ...member,
        m_gender: this.genders.includes(gender) ? gender : '',
        m_country: this.countries.find((option) => option.toLowerCase() === country) ?? '',
        m_phone: hasPrefix ? phone.slice(prefix.length) : phone,
        phoneCode: code,
      },
      address: { address },
    });
  }

  public fieldError(field: ProfileField): string {
    const member = this.editProfileForm.controls.member;
    const control =
      member.get(field) ?? this.editProfileForm.controls.address.controls.address.get(field);
    if (!control || !(control.touched || control.dirty)) {
      return '';
    }
    return field === 'm_phone'
      ? (member.getError('phone') ?? '')
      : profileFieldError(field, control.value);
  }

  public onSubmit(): void {
    if (this.pg() !== 1 || this.isUpdating()) {
      return;
    }

    this.errorMessage.set('');
    this.editProfileForm.markAllAsTouched();

    if (this.editProfileForm.invalid) {
      if (this.editProfileForm.controls.member.invalid) {
        this.pg.set(0);
      }
      this.errorMessage.set('Please complete all required fields.');
      return;
    }

    const {
      member: { phoneCode, ...member },
      address,
    } = this.editProfileForm.getRawValue();
    member.m_phone = internationalPhone(phoneCode, member.m_phone);
    this.updateProfile.emit(normalizeProfileUpdateRequest({ member, address: address.address }));
  }
}
