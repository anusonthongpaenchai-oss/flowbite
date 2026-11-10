import { HttpHeaders } from '@angular/common/http';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { api, type ApiResponse } from '@shared/api/api';
import { clearAuthSession, setAuthSession } from '@shared/guard/auth';
import { QRCodeComponent } from 'angularx-qrcode';
import { WalletAccounts } from '../mt5-wallet/wallet-accounts';
import { Dashboard } from './dashboard';

// Vitest resolves qrcode's Node entry point, which renders terminal text by default.
@Component({ selector: 'qrcode', template: '' })
class ReferralQrStub {
  readonly qrdata = input('');
  readonly elementType = input('');
  readonly width = input(0);
  readonly margin = input(0);
}

describe('Dashboard', () => {
  const member = { id: 1, username: 'member', email: 'member@example.com' };
  let fixture: ComponentFixture<Dashboard>;
  let page: HTMLElement;
  let isKyc: number;
  let activeReferral: string | undefined;
  let referralUnavailable: boolean;
  const referral = 'https://portal.example.test/?ref=356154';
  const sessions = [
    {
      session_uid: 'current-session',
      session_agent: 'Chrome on macOS',
      session_browser: 'Chrome',
      session_os: 'macOS',
      session_city: 'Bangkok',
      session_country: 'TH',
      session_ip: '192.0.2.1',
      session_time: 1794297600,
      session_expire: 1794301200,
      session_latest: '2026-11-10T08:00:00',
    },
    {
      session_uid: 'other-session',
      session_agent: 'Firefox on Linux',
      session_browser: 'Firefox',
      session_os: 'Linux',
      session_city: 'Chiang Mai',
      session_country: 'TH',
      session_ip: '192.0.2.2',
      session_time: 1794297600,
      session_expire: 1794301200,
      session_latest: 1794297600,
    },
  ];

  function response(data: unknown, result = true): ApiResponse {
    return { data: { result, data }, status: 200, statusText: 'OK', headers: new HttpHeaders() };
  }

  beforeEach(() => {
    isKyc = 1;
    activeReferral = referral;
    referralUnavailable = false;
    setAuthSession({
      require2FA: false,
      member,
      accessToken: 'access',
      refreshToken: 'refresh',
      sessionUid: 'current-session',
      expiresIn: 3600,
    });
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      switch (url) {
        case '/v1/member/profile':
          return response({ member: { ...member, isKyc }, address: {} });
        case '/v1/verify/kyc':
          return response({ kyc_stat: 1 });
        case '/v1/trading':
          return response([
            {
              id: 1,
              wallet_type: 'main',
              wallet_account_name: 'Central Wallet',
              wallet_account_no: '123456789',
              wallet_balance: 0,
              wallet_status: 1,
            },
          ]);
        case '/v1/wallet/account-summary':
          return response({ live: { current: 0, max: 5 } });
        case '/v1/auth/sessions/active':
          return {
            ...response(sessions),
            data: { result: true, data: sessions, referralLink: activeReferral },
          };
        case '/v1/member/referral-link':
          if (referralUnavailable) throw new Error('Referral unavailable');
          return response({ referralLink: referral });
        default:
          throw new Error('Unexpected GET ' + url);
      }
    });
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), WalletAccounts],
    }).overrideComponent(Dashboard, {
      remove: { imports: [QRCodeComponent] },
      add: { imports: [ReferralQrStub] },
    });
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render() {
    fixture = TestBed.createComponent(Dashboard);
    page = fixture.nativeElement;
    await fixture.whenStable();
  }

  function button(label: string, scope = page): HTMLButtonElement {
    const match = [...scope.querySelectorAll('button')].find(
      (element) => element.textContent?.trim() === label || element.ariaLabel === label,
    );
    expect(match, label).toBeDefined();
    return match!;
  }

  it('renders the verified portal and rechecks KYC before opening a live account', async () => {
    await render();
    expect(page.querySelector('a[href="/user/verify"]')).toBeNull();
    expect(page.querySelector('app-wallet-account-table')?.textContent).toContain('Central Wallet');
    expect(
      page.querySelectorAll(
        'app-verify-status, app-google-auth, app-phone-verify, app-email-verify',
      ),
    ).toHaveLength(4);

    button('Open Live Account').click();
    await fixture.whenStable();
    expect(page.querySelector('#create-wallet-dialog[open]')).not.toBeNull();
  });

  it('links an unverified member to User Verify and opens the KYC popup from My Portal', async () => {
    isKyc = 0;
    await render();
    expect(page.querySelector('a[href="/user/verify"]')?.textContent).toContain('Click to Verify');

    button('Open Live Account').click();
    await fixture.whenStable();
    expect(page.querySelector('#wallet-kyc-dialog[open]')).not.toBeNull();
    expect(page.querySelector('app-create-account')).toBeNull();
  });

  it('copies the referralLink from the active sessions response', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: { writeText } } }));
    await render();
    expect(page.querySelector<HTMLInputElement>('input[aria-label="Referral link"]')?.value).toBe(
      referral,
    );
    button('Copy link').click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(referral);
    expect(api.get).not.toHaveBeenCalledWith('/v1/member/referral-link');
  });

  it('can retry the member referral endpoint when active sessions omit the link', async () => {
    activeReferral = undefined;
    referralUnavailable = true;
    await render();
    expect(page.textContent).toContain('Your referral link is unavailable.');

    referralUnavailable = false;
    button('Retry referral link').click();
    await fixture.whenStable();
    expect(page.querySelector<HTMLInputElement>('input[aria-label="Referral link"]')?.value).toBe(
      referral,
    );
  });

  it('retries a rejected revoke, sends the selected session UID, and preserves the current session', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValueOnce(response({ sessionRevoked: false }, false))
      .mockResolvedValueOnce(response({ sessionRevoked: true, sessionUid: 'other-session' }));
    await render();
    expect(page.querySelector('img[alt="Current session"]')).not.toBeNull();
    expect(page.textContent).toContain('2026-11-10 08:00:00');
    expect(page.textContent).toContain('Chiang Mai');

    button('Sign out Firefox session').click();
    await fixture.whenStable();
    button('Cancel').click();
    await fixture.whenStable();
    expect(page.querySelector('app-propup-revoke')).toBeNull();
    expect(post).not.toHaveBeenCalled();

    button('Sign out Firefox session').click();
    await fixture.whenStable();
    button('Confirm').click();
    await fixture.whenStable();
    expect(page.querySelector('app-propup-revoke dialog[open]')).not.toBeNull();
    expect(page.textContent).toContain('Chiang Mai');

    button('Confirm').click();
    await fixture.whenStable();
    expect(post).toHaveBeenLastCalledWith('/v1/auth/session/revoke', {
      sessionUid: 'other-session',
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(page.querySelector('app-propup-revoke')).toBeNull();
    expect(page.textContent).not.toContain('Chiang Mai');
    expect(page.querySelector('img[alt="Current session"]')).not.toBeNull();
  });
});
