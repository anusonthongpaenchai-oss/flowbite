import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from '../shared/guard/auth';
import { Login } from './page/login/login';
import { Signup } from './page/signup/signup';
import { AccountLayout } from './components/layouts/account-layout/account-layout';
import { accountChildRoutes } from './components/layouts/account-layout/account.routes';
import { ForgotPassword } from './page/forgot-password/forgot-password';
import { Verify } from './page/verify/verify';
import { PortalLayout } from './components/layouts/portal-layout/portal-layout';
import { walletKycGuard } from './wallet-kyc.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: Login,
    canActivate: [() => !authGuard() || inject(Router).createUrlTree(['/dashboard'])],
  },
  { path: 'signup', component: Signup },
  { path: 'forgot-password', component: ForgotPassword },

  // Auth router
  {
    path: '',
    component: PortalLayout,
    canActivate: [() => authGuard() || inject(Router).createUrlTree(['/'])],
    canActivateChild: [() => authGuard() || inject(Router).createUrlTree(['/'])],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./page/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'mt5-wallet',
        canActivate: [walletKycGuard],
        loadComponent: () => import('./page/mt5-wallet/mt5-wallet').then((m) => m.Mt5Wallet),
      },
      { path: 'user-info', component: AccountLayout, children: accountChildRoutes },
      {
        path: 'user',
        component: AccountLayout,
        children: [{ path: 'verify', component: Verify, data: { label: 'User verify' } }],
      },
    ],
  },
];
