import { Component, computed, inject, OnInit, PendingTasks, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { logout } from '../../../shared/api/auth/logout';
import { getUserInfo } from '../../../shared/api/userInfo/userInfo';
import { Button } from '../../components/button/button';

@Component({
  imports: [RouterLink, Button],
  selector: 'app-user-info',
  styleUrl: './user-info.css',
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

  public isChangeImageProfile = signal<boolean>(false);
  public isChangePassword = signal<boolean>(false);
  public isEditProfile = signal<boolean>(false);

  // user info
  public memberId = signal<number>(0);
  public imgUrl = signal<string>('');

  // general info
  public firstName = signal('');
  public lastName = signal('');
  public gender = signal('');
  public country = signal('');

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

  // social info (mock until these fields are available from the API)
  public googleLink = signal<boolean>(false);
  public facebookLink = signal<boolean>(true);
  public appleLink = signal<boolean>(false);

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

  ngOnInit(): void {
    this.pendingTasks.run(() => this.loadUserInfo());
  }

  public async handleLogout(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.logoutErrorMessage.set('');

    try {
      await logout();
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (error) {
      this.logoutErrorMessage.set(
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      this.isLoggingOut.set(false);
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

      const { member, address } = response.data;

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
