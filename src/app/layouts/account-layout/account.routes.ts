import type { Routes } from '@angular/router';
import { AccountPlaceholder } from '../../page/account-placeholder/account-placeholder';
import { UserInfo } from '../../page/user-info/user-info';

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
    component: AccountPlaceholder,
    data: { label: 'User verify' },
  },
];
