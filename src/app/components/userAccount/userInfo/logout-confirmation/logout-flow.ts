import { DestroyRef, inject, Injectable, PendingTasks, signal } from '@angular/core';
import { Router } from '@angular/router';
import { logout } from '../../../../../shared/api/auth/logout';
import { logoutSessions } from '../../../../../shared/api/auth/logoutSessions';
import { getAuthSession, onAuthSessionChange } from '../../../../../shared/guard/auth';

@Injectable()
export class LogoutFlow {
  private readonly pendingTasks = inject(PendingTasks);
  private readonly router = inject(Router);

  readonly isLoggingOut = signal(false);
  readonly errorMessage = signal('');
  readonly isOpen = signal(false);
  readonly canRemoveRememberedDevices = signal(false);

  constructor() {
    const unsubscribe = onAuthSessionChange(() => {
      if (this.isOpen()) {
        this.updateRememberedDevices();
      }
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  open(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.errorMessage.set('');
    this.updateRememberedDevices();
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isLoggingOut()) {
      this.isOpen.set(false);
    }
  }

  async confirm(removeRememberedDevices: boolean): Promise<void> {
    if (this.isLoggingOut() || !this.isOpen()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.errorMessage.set('');
    const completeTask = this.pendingTasks.add();

    try {
      if (this.canRemoveRememberedDevices() && removeRememberedDevices) {
        await logoutSessions();
      } else {
        await logout();
      }
      this.isOpen.set(false);
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      this.isLoggingOut.set(false);
      completeTask();
    }
  }

  private updateRememberedDevices(): void {
    // Completed 2FA sessions also have require2FA: false; use the saved 2FA status.
    const session = getAuthSession();
    this.canRemoveRememberedDevices.set(
      session?.twoFaEnabled === true && session.rememberDevice === true,
    );
  }
}
