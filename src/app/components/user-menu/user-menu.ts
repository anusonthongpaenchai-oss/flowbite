import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Member } from '../../../shared/api/auth/login';

@Component({
  imports: [RouterLink],
  selector: 'app-user-menu',
  host: {
    class: 'relative block',
    '(document:click)': 'dismissOutside($event.target)',
    '(focusout)': 'dismissOutside($event.relatedTarget)',
    '(keydown.escape)': 'onEscape($event)',
  },
  templateUrl: './user-menu.html',
})
export class UserMenu {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly member = input<Member | null>(null);
  readonly isLoggingOut = input(false);
  readonly logoutRequested = output<void>();

  protected readonly isOpen = signal(false);
  protected readonly failedAvatarUrl = signal('');
  protected readonly avatarUrl = computed(() => this.member()?.m_image_url?.trim() ?? '');
  protected readonly username = computed(() => {
    const member = this.member();
    return member?.m_username?.toString().trim() || member?.username?.trim() || '';
  });
  protected readonly name = computed(
    () => this.member()?.m_name?.trim() || this.username() || 'User',
  );
  protected readonly usernameLabel = computed(() => {
    const username = this.username();
    return username && !username.startsWith('#') ? `#${username}` : username;
  });
  protected readonly links = [
    { label: 'USER INFO', route: '/user-info', icon: 'svg/icon/user-outline.svg' },
    {
      label: 'KYC VERIFICATION',
      route: '/user/verify',
      icon: 'svg/icon/circle-check-glass-outline.svg',
    },
    { label: 'BANK ACCOUNT', route: '/user-info/bank-account', icon: 'svg/icon/building-bank.svg' },
  ];

  protected dismissOutside(target: EventTarget | null): void {
    if (this.isOpen() && target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  protected onEscape(event: Event): void {
    if (this.isOpen()) {
      event.stopPropagation();
      this.closeAndRestoreFocus();
    }
  }

  protected closeAndRestoreFocus(): void {
    this.isOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  protected requestPasswordChange(): void {
    this.closeAndRestoreFocus();
    void this.router.navigateByUrl('/user-info', {
      info: 'change-password',
      onSameUrlNavigation: 'reload',
    });
  }
}
