import { CurrencyPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Member } from '../../../shared/api/auth/login';

export type PortalPage = 'dashboard' | 'wallet' | 'account';

type SidebarItem = {
  label: string;
  icon: string;
  url?: string;
  page?: PortalPage;
  chevron?: boolean;
};

@Component({
  selector: 'app-sidebar',
  imports: [CurrencyPipe, DecimalPipe, NgTemplateOutlet, RouterLink],
  host: { class: 'block h-full min-h-0' },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  readonly member = input<Member | null>(null);
  readonly availableBalance = input<number | null>(null);
  readonly pointsCredit = input<number | null>(null);
  readonly collapsed = input(false);
  readonly mobile = input(false);
  readonly activePage = input<PortalPage>('dashboard');
  readonly isLoggingOut = input(false);
  readonly toggleRequested = output<void>();
  readonly navigated = output<void>();
  readonly logoutRequested = output<void>();
  readonly failedImage = signal('');

  readonly fullName = computed(() => {
    const member = this.member();
    return (
      [member?.m_name, member?.m_lastname]
        .filter((name) => name?.trim())
        .join(' ')
        .trim() ||
      member?.username ||
      'User'
    );
  });
  readonly initials = computed(() =>
    this.fullName()
      .split(/\s+/)
      .slice(0, 2)
      .map((name) => name[0])
      .join('')
      .toUpperCase(),
  );
  readonly avatarUrl = computed(() => this.member()?.m_image_url?.trim() ?? '');

  readonly groups: { label: string; items: SidebarItem[] }[] = [
    {
      label: 'General',
      items: [
        {
          label: 'Dashboard',
          url: '/dashboard',
          page: 'dashboard',
          icon: 'svg/sidebar/layout-dashboard.svg',
        },
        {
          label: 'MT5 & Wallet',
          url: '/mt5-wallet',
          page: 'wallet',
          icon: 'svg/icon/wallet.svg',
        },
      ],
    },
    {
      label: 'Feature',
      items: [
        { label: 'Pip Battle', icon: 'svg/sidebar/diamond.svg' },
        {
          label: 'Social Trade',
          chevron: true,
          icon: 'svg/sidebar/users.svg',
        },
        { label: 'Guzebot', icon: 'svg/sidebar/robot-face.svg' },
        { label: 'Investment', icon: 'svg/sidebar/cash-banknote.svg' },
        { label: 'Rebate Program', icon: 'svg/sidebar/gift.svg' },
        { label: 'Transactions', icon: 'svg/sidebar/arrows-right-left.svg' },
      ],
    },
    {
      label: 'Partner Program',
      items: [
        { label: 'IB Partner', icon: 'svg/sidebar/transform-point-bottom-left.svg' },
        { label: 'Referrals', icon: 'svg/sidebar/user-plus.svg' },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Notification Center', icon: 'svg/sidebar/bell-ringing.svg' },
        {
          label: 'User Account',
          url: '/user-info',
          page: 'account',
          icon: 'svg/sidebar/user-circle.svg',
        },
        { label: 'Account Security', icon: 'svg/sidebar/shield-check.svg' },
        { label: 'Download MT5', icon: 'svg/sidebar/cloud-download.svg' },
      ],
    },
  ];
}
