import { Routes } from '@angular/router';
import { Login } from './page/login/login';
import { Signup } from './page/signup/signup';
import { UserInfo } from './page/user-info/user-info';

export const routes: Routes = [
    { path: '', component: Login },
    { path: 'signup', component: Signup },
    { path: 'user-info', component: UserInfo }
];
