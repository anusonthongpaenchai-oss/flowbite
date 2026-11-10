import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, PendingTasks, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CardWallet } from '@components/mt5andWallet/card-wallet/card-wallet';
import { CreateAccount } from '@components/mt5andWallet/create-account/create-account';
import { WalletAccountTable } from '@components/mt5andWallet/wallet-account-table/wallet-account-table';
import { PropupKyc } from '@components/propup-kyc/propup-kyc';
import { PropupRevoke } from '@components/propup-revoke/propup-revoke';
import { Button } from '@components/ui/button/button';
import { getActiveUser, type ActiveSession } from '@shared/api/activeUser';
import { getReferralLink } from '@shared/api/referral';
import { revokeUserSession } from '@shared/api/revoke';
import { getAuthSession } from '@shared/guard/auth';
import { checkWalletKyc, type WalletKycNotice } from '@shared/guard/wallet-kyc';
import { QRCodeComponent } from 'angularx-qrcode';
import { WalletAccounts } from '../mt5-wallet/wallet-accounts';
import { Verify } from '../verify/verify';
import { createQrPdf } from '../../../shared/qrcode/referral-qr-pdf';

@Component({
  imports: [
    Button,
    CardWallet,
    CreateAccount,
    DatePipe,
    PropupKyc,
    PropupRevoke,
    QRCodeComponent,
    RouterLink,
    Verify,
    WalletAccountTable,
  ],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly walletAccounts = inject(WalletAccounts);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly router = inject(Router);
  private readonly session = getAuthSession();
  protected readonly currentSessionUid = this.session?.sessionUid;
  protected readonly walletLoadState = this.walletAccounts.loadState;
  protected readonly kycStatus = signal<Awaited<ReturnType<typeof checkWalletKyc>> | null>(null);
  protected readonly showKycAlert = computed(() => {
    const status = this.kycStatus();
    return (
      status === 'wallet-kyc-required' ||
      (status === 'wallet-kyc-unavailable' && this.session?.member.isKYC === 0)
    );
  });
  protected readonly checkingKyc = signal(false);
  protected readonly kycNotice = signal<WalletKycNotice | null>(null);
  protected readonly creatingAccount = signal(false);
  protected readonly selectedAccountNumber = signal<string | null>(null);
  protected readonly tableAccounts = computed(() => {
    if (this.kycStatus() !== 'verified') return [];

    const accounts = this.walletAccounts.accounts();
    const main =
      accounts.find((account) => account.isActiveMainWallet) ??
      accounts.find(({ type, status }) => type === 'main' && status === 0);
    const trading = accounts.filter(
      ({ type, status }) => type === 'trading' && (status === 0 || status === 1),
    );
    return main ? [main, ...trading] : trading;
  });

  protected readonly referralLink = signal('');
  protected readonly loadingReferral = signal(true);
  protected readonly referralMessage = signal('');
  protected readonly downloadingQr = signal(false);
  protected readonly sessionPage = signal({ rows: [] as ActiveSession[], page: 1, hasNext: false });
  protected readonly loadingSessions = signal(false);
  protected readonly sessionsError = signal('');
  protected readonly sessionToRevoke = signal<ActiveSession | null>(null);
  protected readonly revoking = signal(false);
  protected readonly revokeError = signal('');

  constructor() {
    if (!this.currentSessionUid) return;
    this.pendingTasks.run(async () => {
      const status = await checkWalletKyc();
      if (!this.isCurrentSession()) return;
      this.updateKycStatus(status);
      if (status === 'verified' && this.walletLoadState() === 'idle') await this.loadWallets();
    });
    this.pendingTasks.run(async () => {
      await this.loadSessions();
      if (!this.referralLink() && this.isCurrentSession()) {
        await this.loadReferral();
      } else {
        this.loadingReferral.set(false);
      }
    });
  }

  // open live account
  protected async openLiveAccount(): Promise<void> {
    if (this.checkingKyc()) return;
    this.checkingKyc.set(true);
    const status = await checkWalletKyc();
    if (this.isCurrentSession()) {
      this.updateKycStatus(status);
      if (status === 'verified') {
        this.creatingAccount.set(true);
        if (this.walletLoadState() === 'idle') void this.loadWallets();
      } else {
        this.kycNotice.set(status);
      }
    }
    this.checkingKyc.set(false);
  }

  // close create account
  protected closeCreateAccount(refresh: boolean): void {
    this.creatingAccount.set(false);
    if (refresh) {
      if (this.walletLoadState() === 'loading') this.walletAccounts.reset();
      void this.loadWallets();
    }
  }

  // require verification
  protected requireVerification(): void {
    this.creatingAccount.set(false);
    this.updateKycStatus('wallet-kyc-required');
    this.kycNotice.set('wallet-kyc-required');
  }

  // confirm identity
  protected confirmIdentity(): void {
    this.kycNotice.set(null);
    void this.router.navigateByUrl('/user/verify');
  }

  // load wallets
  protected loadWallets(): Promise<void> {
    return this.walletAccounts.load();
  }

  // copy referral link
  protected async copyReferral(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.referralLink());
      this.referralMessage.set('Link copied.');
    } catch {
      this.referralMessage.set('Unable to copy automatically. Select the link to copy it.');
    }
  }

  // download qr code as pdf
  protected async downloadReferralQr(container: HTMLElement): Promise<void> {
    if (this.downloadingQr()) return;
    const svg = container.querySelector('svg');
    if (!svg) {
      this.referralMessage.set('The QR code is unavailable. Please try again.');
      return;
    }
    this.downloadingQr.set(true);
    this.referralMessage.set('');
    try {
      const pdf = await createQrPdf(svg);
      if (!this.isCurrentSession()) return;
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'referral-qr.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.referralMessage.set('Unable to download the QR code. Please try again.');
    } finally {
      this.downloadingQr.set(false);
    }
  }

  // load sessions
  protected async loadSessions(page = 1): Promise<void> {
    if (this.loadingSessions()) return;
    this.loadingSessions.set(true);
    this.sessionsError.set('');
    try {
      const response = await getActiveUser(page);
      if (!this.isCurrentSession()) return;
      if (response?.result !== true || !Array.isArray(response.data)) {
        throw new Error('Invalid active sessions response.');
      }

      const referral = response.referralLink;
      if (typeof referral === 'string' && referral.trim()) this.referralLink.set(referral.trim());
      this.sessionPage.set({
        rows: response.data,
        page,
        hasNext: response.pagination?.hasNext === true,
      });
    } catch {
      this.sessionsError.set('Unable to load active sessions. Please try again.');
    } finally {
      this.loadingSessions.set(false);
    }
  }

  // format session date
  protected sessionDate(value: ActiveSession['session_latest']): Date | null {
    if (value == null || String(value).trim() === '') return null;
    const timestamp = Number(value);
    const date = Number.isFinite(timestamp)
      ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
      : new Date(String(value).replace(' ', 'T'));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  // open revoke
  protected openRevoke(session: ActiveSession): void {
    if (!session.session_uid || session.session_uid === this.currentSessionUid) return;
    this.revokeError.set('');
    this.sessionToRevoke.set(session);
  }

  // confirm revoke
  protected async confirmRevoke(): Promise<void> {
    const uid = this.sessionToRevoke()?.session_uid;
    if (!uid || uid === this.currentSessionUid || this.revoking() || !this.isCurrentSession())
      return;
    this.revoking.set(true);
    this.revokeError.set('');
    try {
      const response = await revokeUserSession({ sessionUid: uid });
      if (!this.isCurrentSession()) return;
      if (response?.result !== true || response.data?.sessionRevoked !== true) {
        throw new Error('Session was not revoked.');
      }

      const current = this.sessionPage();
      const rows = current.rows.filter(({ session_uid }) => session_uid !== uid);
      this.sessionPage.set({ ...current, rows });
      this.sessionToRevoke.set(null);
      if (current.hasNext || current.page > 1) {
        await this.loadSessions(rows.length || current.hasNext ? current.page : current.page - 1);
      }
    } catch {
      this.revokeError.set('Unable to sign out this session. Please try again.');
    } finally {
      this.revoking.set(false);
    }
  }

  // load referral
  protected async loadReferral(): Promise<void> {
    this.loadingReferral.set(true);
    try {
      const response = await getReferralLink();
      const referral = response?.data?.referralLink;
      if (
        this.isCurrentSession() &&
        !this.referralLink() &&
        response?.result === true &&
        typeof referral === 'string'
      ) {
        this.referralLink.set(referral.trim());
      }
    } catch {
      // The referral panel shows an unavailable state.
    } finally {
      this.loadingReferral.set(false);
    }
  }

  // is current session
  private isCurrentSession(): boolean {
    const current = getAuthSession();
    return (
      !this.destroyRef.destroyed &&
      current !== null &&
      current.sessionUid === this.currentSessionUid &&
      current.member.id === this.session?.member.id
    );
  }

  // update kyc status
  private updateKycStatus(status: Awaited<ReturnType<typeof checkWalletKyc>>): void {
    this.kycStatus.set(status);
    if (status === 'wallet-kyc-required') this.walletAccounts.reset();
  }
}
