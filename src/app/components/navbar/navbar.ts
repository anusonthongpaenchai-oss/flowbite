import { Component, input } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-navbar',
  host: { class: 'block' },
  templateUrl: './navbar.html',
})
export class Navbar {
  readonly pageTitle = input('');
  readonly logo = 'svg/Logo.svg';
  readonly english = 'svg/language/English.svg';
}
