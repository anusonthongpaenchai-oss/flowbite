import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { startTokenRefresh, stopTokenRefresh } from '../shared/services/tokenRefreshScheduler';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('POX');

  constructor() {
    const router = inject(Router);
    startTokenRefresh(() => {
      void router.navigateByUrl('/', { replaceUrl: true });
    });
    inject(DestroyRef).onDestroy(stopTokenRefresh);
  }
}
