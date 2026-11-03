import { Routes } from '@angular/router';
import { Login } from './page/login/login';
import { Signup } from './page/signup/signup';


export const routes: Routes = [
    { path: '', component: Login },
    { path: 'signup', component: Signup }
];
