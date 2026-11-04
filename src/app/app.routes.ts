import { Routes } from '@angular/router';
import { Login } from './page/login/login';
import { Signup } from './page/signup/signup';
import { AccountLayout } from './layouts/account-layout/account-layout';
import { accountChildRoutes } from './layouts/account-layout/account.routes';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'signup', component: Signup },
  { path: 'user-info', component: AccountLayout, children: accountChildRoutes },
];
