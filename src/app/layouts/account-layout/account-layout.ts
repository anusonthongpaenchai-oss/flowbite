import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { accountChildRoutes } from './account.routes';

@Component({
  selector: 'app-account-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  host: { class: 'block min-h-dvh bg-[#f9fafb] text-[#111928]' },
  templateUrl: './account-layout.html',
})
export class AccountLayout {
  readonly tabs = accountChildRoutes.map((route) => ({
    label: route.data!['label'] as string,
    url:
      (route.data?.['url'] as string | undefined) ??
      (route.path ? `/user-info/${route.path}` : '/user-info'),
  }));
}
