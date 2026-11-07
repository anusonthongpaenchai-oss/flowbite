import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Sidebar, type PortalPage } from '../../sidebar/sidebar';
import { Navbar } from '../../navbar/navbar';
import { Button } from '../../ui/button/button';
import { getAuthSession, onAuthSessionChange } from '../../../../shared/guard/auth';
import { WalletAccounts } from '../../../page/mt5-wallet/wallet-accounts';

@Component({
  selector: 'app-portal-layout',
  imports: [RouterLink, RouterOutlet, Sidebar, Navbar, Button],
  providers: [WalletAccounts],
  host: { class: 'block min-h-dvh bg-[#f9fafb] text-[#111928]' },
  templateUrl: './portal-layout.html',
})
export class PortalLayout {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly walletAccounts = inject(WalletAccounts);
  private readonly desktopQuery = window.matchMedia?.('(min-width: 1024px)');
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  readonly session = signal(getAuthSession());
  readonly collapsed = signal(false);
  readonly desktop = signal(this.desktopQuery?.matches ?? true);
  readonly drawerOpen = signal(false);
  readonly activePage = signal(this.pageFor(this.router.url));
  readonly pageTitle = computed(() => {
    const titles: Record<PortalPage, string> = {
      dashboard: 'Dashboard',
      wallet: 'MT5 & Wallet',
      account: 'User Account',
    };
    return titles[this.activePage()];
  });

  constructor() {
    const synchronize = () => {
      const previousMemberId = this.session()?.member.id;
      const session = getAuthSession();
      this.session.set(session);
      if (session?.member.id !== previousMemberId) {
        this.walletAccounts.reset();
        if (session) void this.walletAccounts.load();
      }
      if (!session) {
        this.closeDrawer();
        void this.router.navigateByUrl('/', { replaceUrl: true });
      }
    };
    this.destroyRef.onDestroy(onAuthSessionChange(synchronize));

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'authSession' || event.key === null) synchronize();
    };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));

    const onResize = (event: MediaQueryListEvent) => {
      this.desktop.set(event.matches);
      this.closeDrawer();
    };
    this.desktopQuery?.addEventListener('change', onResize);
    this.destroyRef.onDestroy(() => this.desktopQuery?.removeEventListener('change', onResize));

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.activePage.set(this.pageFor(event.urlAfterRedirects));
        this.closeDrawer();
        if (this.session() && this.walletAccounts.loadState() === 'idle') {
          void this.walletAccounts.load();
        }
      }
    });
  }

  openDrawer(): void {
    const dialog = this.drawer()?.nativeElement;
    if (this.desktop() || !dialog || dialog.open) return;
    dialog.showModal();
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    const dialog = this.drawer()?.nativeElement;
    if (!this.drawerOpen() && !dialog?.open) return;
    dialog?.close();
    this.drawerOpen.set(false);
    if (!this.desktop()) this.menuButton()?.nativeElement.focus();
  }

  cancelDrawer(event: Event): void {
    event.preventDefault();
    this.closeDrawer();
  }

  onBackdropClick(event: MouseEvent): void {
    const dialog = this.drawer()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.closeDrawer();
  }

  private pageFor(url: string): PortalPage {
    if (/^\/mt5-wallet(?:[;/?#]|$)/.test(url)) return 'wallet';
    return /^\/user(?:-info|\/verify)(?:[/?#]|$)/.test(url) ? 'account' : 'dashboard';
  }
}
