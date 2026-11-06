import type { Routes } from '@angular/router';
import { AccountPlaceholder } from '../../page/account-placeholder/account-placeholder';
import { UserInfo } from '../../page/user-info/user-info';
import { GoogleAuth } from '@components/google-auth/google-auth';

export const accountChildRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: UserInfo,
    data: { label: 'User information' },
  },
  {
    path: 'bank-account',
    component: AccountPlaceholder,
    data: { label: 'Bank Account' },
  },
  {
    path: 'crypto-wallet',
    component: AccountPlaceholder,
    data: { label: 'Crypto Wallet' },
  },
  {
    path: 'user-verify',
    pathMatch: 'full',
    redirectTo: '/user/verify',
    data: { label: 'User verify', url: '/user/verify' },
  },
];
