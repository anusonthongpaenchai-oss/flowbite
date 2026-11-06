import { Component, computed, inject, OnInit, PendingTasks, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  normalizeProfileUpdateRequest,
  profileUpdate,
  type ProfileUpdateRequest,
} from '../../../shared/api/userInfo/profileUpdate';

// components
import { Button } from '../../components/button/button';
import { EditProfile } from '../../components/userInfo/edit-profile/edit-profile';
import { ChangImage } from '../../components/userInfo/chang-image/chang-image';
import { ChangPassword } from '../../components/userInfo/chang-password/chang-password';
import { LogoutConfirmation } from '../../components/userInfo/logout-confirmation/logout-confirmation';

// api
import { logout } from '../../../shared/api/auth/logout';
import { logoutSessions } from '../../../shared/api/auth/logoutSessions';
import { getUserInfo } from '../../../shared/api/userInfo/userInfo';
import {
  clearAuthSession,
  getAuthSession,
  getRememberedAuthSession,
  setAuthSession,
} from '../../../shared/guard/auth';
@Component({
  imports: [Button, EditProfile, ChangImage, ChangPassword, LogoutConfirmation],
  selector: 'app-user-info',
  host: { class: 'block' },
  templateUrl: './user-info.html',
})
export class UserInfo implements OnInit {
  // svg
  readonly logoutIcon = 'svg/icon/logout-2.svg';
  readonly linkIcon = 'svg/icon/link.svg';

  private readonly pendingTasks = inject(PendingTasks);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly isLoggingOut = signal(false);
  readonly logoutErrorMessage = signal('');
  readonly isLogoutConfirmationOpen = signal(false);
  readonly canRemoveRememberedDevices = signal(false);

  public isChangeImageProfile = signal<boolean>(false);
  public isChangePassword = signal<boolean>(false);
  public isEditProfile = signal<boolean>(false);
  readonly isUpdating = signal(false);
  readonly updateErrorMessage = signal('');
  readonly updateSuccessMessage = signal('');

  // user info
  public memberId = signal<number>(0);
  public imgUrl = signal<string>('');

  // general info
  public firstName = signal('');
  public lastName = signal('');
  public gender = signal('');
  public country = signal('');

  // edit profile
  readonly fullName = computed(
    () => [this.firstName(), this.lastName()].filter(Boolean).join(' ') || '—',
  );
  readonly initials = computed(
    () => `${this.firstName().charAt(0)}${this.lastName().charAt(0)}`.toUpperCase() || 'U',
  );

  // contact info
  public email = signal('');
  public phone = signal('');
  public phoneCode = signal('');

  readonly formattedPhone = computed(() => {
    const countryCode = this.phoneCode().replace(/\D/g, '');
    let number = this.phone().replace(/\D/g, '');

    if (!number) {
      return '';
    }

    if (countryCode && number.startsWith(countryCode) && number.length > 10) {
      number = number.slice(countryCode.length);
    }

    if (countryCode === '66') {
      number = number.replace(/^0(?=\d{9}$)/, '');
    }

    const formattedNumber = number.replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');
    return `${countryCode ? `+${countryCode}` : ''}${formattedNumber}`;
  });

  // social info (mock)
  public googleLink = signal<boolean>(false);
  public facebookLink = signal<boolean>(true);
  public appleLink = signal<boolean>(false);

  // social icon
  readonly socialAccounts = [
    { name: 'Google', icon: 'svg/social/Google.svg', linked: this.googleLink },
    { name: 'Facebook', icon: 'svg/social/Facebook.svg', linked: this.facebookLink },
    { name: 'Apple', icon: 'svg/social/Apple.svg', linked: this.appleLink },
  ];

  // address info
  public address = signal<string>('');
  public subDistrict = signal<string>('');
  public district = signal<string>('');
  public province = signal<string>('');
  public zipCode = signal<string>('');

  // edit profile data
  readonly editProfileData = computed<ProfileUpdateRequest>(() => ({
    member: {
      m_name: this.firstName(),
      m_lastname: this.lastName(),
      m_phone: this.phone(),
      m_gender: this.gender(),
      m_country: this.country(),
    },
    address: {
      address_no: this.address(),
      address_district: this.subDistrict(),
      address_city: this.district(),
      address_state: this.province(),
      address_zipcode: this.zipCode(),
    },
  }));

  public openChangeImageProfile(): void {
    if (this.isLoading() || this.isUpdating() || !this.memberId()) {
      return;
    }
    this.updateSuccessMessage.set('');
    this.isChangeImageProfile.set(true);
  }

  public onImageSaved(): void {
    this.isChangeImageProfile.set(false);
    this.updateSuccessMessage.set('Profile image updated successfully.');
    this.pendingTasks.run(() => this.loadUserInfo());
  }

  public async onPasswordChanged(): Promise<void> {
    this.isChangePassword.set(false);
    clearAuthSession();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }

  public openEditProfile(): void {
    if (this.isLoading() || this.isUpdating() || !this.memberId()) {
      return;
    }
    this.updateErrorMessage.set('');
    this.updateSuccessMessage.set('');
    this.isEditProfile.set(true);
  }

  public closeEditProfile(): void {
    if (!this.isUpdating()) {
      this.isEditProfile.set(false);
      this.updateErrorMessage.set('');
    }
  }

  public async onUpdate(body: ProfileUpdateRequest): Promise<void> {
    if (this.isUpdating()) {
      return;
    }

    this.isUpdating.set(true);
    this.updateErrorMessage.set('');
    this.updateSuccessMessage.set('');
    const completeTask = this.pendingTasks.add();

    try {
      const update = normalizeProfileUpdateRequest(body);
      const response = await profileUpdate(update);

      this.firstName.set(update.member.m_name);
      this.lastName.set(update.member.m_lastname);
      this.phone.set(update.member.m_phone);
      this.gender.set(update.member.m_gender);
      this.country.set(update.member.m_country);
      this.address.set(update.address.address_no);
      this.subDistrict.set(update.address.address_district);
      this.district.set(update.address.address_city);
      this.province.set(update.address.address_state);
      this.zipCode.set(update.address.address_zipcode);

      this.isEditProfile.set(false);
      this.updateSuccessMessage.set(response.message);
      await this.loadUserInfo();
    } catch (error) {
      this.updateErrorMessage.set(
        error instanceof Error ? error.message : 'Unable to update your profile. Please try again.',
      );
    } finally {
      this.isUpdating.set(false);
      completeTask();
    }
  }

  ngOnInit(): void {
    this.pendingTasks.run(() => this.loadUserInfo());
  }

  public openLogoutConfirmation(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.logoutErrorMessage.set('');
    // Completed 2FA sessions also have require2FA: false; use the saved 2FA status.
    const session = getAuthSession();
    this.canRemoveRememberedDevices.set(
      session?.twoFaEnabled === true && session.rememberDevice === true,
    );
    this.isLogoutConfirmationOpen.set(true);
  }

  public closeLogoutConfirmation(): void {
    if (!this.isLoggingOut()) {
      this.isLogoutConfirmationOpen.set(false);
    }
  }

  public async handleLogout(removeRememberedDevices: boolean): Promise<void> {
    if (this.isLoggingOut() || !this.isLogoutConfirmationOpen()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.logoutErrorMessage.set('');
    const completeTask = this.pendingTasks.add();

    try {
      if (this.canRemoveRememberedDevices() && removeRememberedDevices) {
        await logoutSessions();
      } else {
        await logout();
      }
      this.isLogoutConfirmationOpen.set(false);
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (error) {
      this.logoutErrorMessage.set(
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      this.isLoggingOut.set(false);
      completeTask();
    }
  }

  private async loadUserInfo(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await getUserInfo();

      if (!response?.result || !response.data?.member) {
        throw new Error(response?.message || 'Unable to load your profile. Please try again.');
      }

      const { member, address, isTrusted } = response.data;
      const session = getAuthSession();

      // Trusted logins skip OTP; restore device trust from the server, not the latest form.
      if (session && session.member.id === member.id && typeof isTrusted === 'boolean') {
        const twoFaEnabled = isTrusted || session.twoFaEnabled === true;
        if (session.rememberDevice !== isTrusted || session.twoFaEnabled !== twoFaEnabled) {
          setAuthSession(
            { ...session, twoFaEnabled, rememberDevice: isTrusted },
            getRememberedAuthSession() !== null,
          );
        }
        this.canRemoveRememberedDevices.set(isTrusted);
      }

      this.memberId.set(member.id ?? 0);
      this.imgUrl.set(member.m_image_url ?? '');

      this.firstName.set(member.m_name ?? '');
      this.lastName.set(member.m_lastname ?? '');
      this.gender.set(member.m_gender ?? '');
      this.country.set(member.m_country ?? '');
      this.email.set(member.email ?? '');
      this.phone.set(member.m_phone ?? '');
      this.phoneCode.set(member.m_phone_code ?? '');

      this.address.set(address?.address_no ?? '');
      this.subDistrict.set(address?.address_district ?? '');
      this.district.set(address?.address_city ?? '');
      this.province.set(address?.address_state ?? '');
      this.zipCode.set(address?.address_zipcode ?? '');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to load your profile. Please try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
