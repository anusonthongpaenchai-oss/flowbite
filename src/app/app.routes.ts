import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from '../shared/guard/auth';
import { Login } from './page/login/login';
import { Signup } from './page/signup/signup';
import { AccountLayout } from './layouts/account-layout/account-layout';
import { accountChildRoutes } from './layouts/account-layout/account.routes';
import { ForgotPassword } from './page/forgot-password/forgot-password';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Login },
  { path: 'signup', component: Signup },
  { path: 'forgot-password', component: ForgotPassword },

  // Auth router
  {
    path: '',
    canActivate: [() => authGuard() || inject(Router).createUrlTree(['/'])],
    canActivateChild: [() => authGuard() || inject(Router).createUrlTree(['/'])],
    children: [{ path: 'user-info', component: AccountLayout, children: accountChildRoutes }],
  },
];
