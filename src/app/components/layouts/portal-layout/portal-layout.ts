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
import { UserMenu } from '../../user-menu/user-menu';
import { Button } from '../../ui/button/button';
import { getAuthSession, onAuthSessionChange } from '../../../../shared/guard/auth';
import { WalletAccounts } from '../../../page/mt5-wallet/wallet-accounts';
import { checkWalletKyc, type WalletKycNotice } from '../../../../shared/guard/wallet-kyc';
import { PropupKyc } from '../../propup-kyc/propup-kyc';
import { LogoutConfirmation } from '../../userAccount/userInfo/logout-confirmation/logout-confirmation';
import { LogoutFlow } from '../../userAccount/userInfo/logout-confirmation/logout-flow';

@Component({
  selector: 'app-portal-layout',
  imports: [
    RouterLink,
    RouterOutlet,
    Sidebar,
    Navbar,
    UserMenu,
    Button,
    PropupKyc,
    LogoutConfirmation,
  ],
  providers: [WalletAccounts, LogoutFlow],
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
  private readonly suspendingWalletRoute = signal(false);

  readonly session = signal(getAuthSession());
  // Recreate the routed view only when its authenticated identity changes.
  protected readonly routeSessionKey = computed(() => {
    const session = this.session();
    return session && !this.suspendingWalletRoute()
      ? JSON.stringify([session.member.id, session.sessionUid])
      : null;
  });
  readonly collapsed = signal(false);
  readonly desktop = signal(this.desktopQuery?.matches ?? true);
  readonly drawerOpen = signal(false);
  protected readonly walletKycNotice = signal<WalletKycNotice | null>(null);
  protected readonly availableBalance = this.walletAccounts.mainBalance;
  protected readonly pointsCredit = this.walletAccounts.pointsCredit;
  protected readonly logoutFlow = inject(LogoutFlow);
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
      const previousSession = this.session();
      const session = getAuthSession();
      this.session.set(session);
      if (
        session?.member.id !== previousSession?.member.id ||
        session?.sessionUid !== previousSession?.sessionUid
      ) {
        this.walletAccounts.reset();
        if (session && this.activePage() === 'wallet') {
          this.suspendingWalletRoute.set(true);
          void this.router.navigateByUrl('/dashboard', { replaceUrl: true });
        } else if (session) {
          this.walletKycNotice.set(null);
          void this.loadSidebarWallets();
        }
      } else if (session?.member.isKYC === 1 && previousSession?.member.isKYC !== 1) {
        void this.loadSidebarWallets();
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
        this.suspendingWalletRoute.set(false);
        this.closeDrawer();
        const info = this.router.lastSuccessfulNavigation()?.extras.info;
        this.walletKycNotice.set(
          info === 'wallet-kyc-required' || info === 'wallet-kyc-unavailable' ? info : null,
        );
        if (this.walletKycNotice()) {
          this.walletAccounts.reset();
        } else {
          void this.loadSidebarWallets();
        }
      }
    });
  }

  protected confirmIdentity(): void {
    this.walletKycNotice.set(null);
    void this.router.navigateByUrl('/user/verify');
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

  private async loadSidebarWallets(): Promise<void> {
    const session = this.session();
    if (
      !session ||
      session.member.isKYC === 0 ||
      this.activePage() !== 'account' ||
      this.walletAccounts.loadState() !== 'idle'
    ) {
      return;
    }

    const kycStatus = await checkWalletKyc();
    const currentSession = this.session();
    if (
      kycStatus === 'verified' &&
      !this.destroyRef.destroyed &&
      currentSession?.sessionUid === session.sessionUid &&
      currentSession.member.id === session.member.id &&
      !this.walletKycNotice() &&
      this.activePage() === 'account' &&
      this.walletAccounts.loadState() === 'idle'
    ) {
      await this.walletAccounts.load();
    }
  }

  private pageFor(url: string): PortalPage {
    if (/^\/mt5-wallet(?:[;/?#]|$)/.test(url)) return 'wallet';
    return /^\/user(?:-info|\/verify)(?:[/?#]|$)/.test(url) ? 'account' : 'dashboard';
  }
}
