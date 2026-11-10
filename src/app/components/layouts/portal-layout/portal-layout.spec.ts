import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { api, ApiError, type ApiResponse } from '../../../../shared/api/api';
import { clearAuthSession, getAuthSession, setAuthSession } from '../../../../shared/guard/auth';
import { routes } from '../../../app.routes';
import { Login } from '../../../page/login/login';
import { UserInfo } from '../../../page/user-info/user-info';
import { PortalLayout } from './portal-layout';

describe('PortalLayout and protected routes', () => {
  const member = {
    id: 1,
    username: 'member',
    m_name: 'Test',
    m_lastname: 'Member',
    email: 'member@example.com',
    m_image_url: '',
  };
  const session = {
    require2FA: false as const,
    member,
    accessToken: 'access',
    refreshToken: 'refresh',
    sessionUid: 'session',
    expiresIn: 3600,
  };
  const protectedUrls = [
    '/dashboard',
    '/user-info',
    '/user-info/bank-account',
    '/user-info/crypto-wallet',
    '/user-info/user-verify',
    '/user/verify',
  ];
  let harness: RouterTestingHarness;
  let media: MediaQueryList;
  const getMock = vi.fn<typeof api.get>();
  const profileGetMock = vi.fn<typeof api.get>();
  const summaryGetMock = vi.fn<typeof api.get>();
  const sessionsGetMock = vi.fn<typeof api.get>();

  beforeEach(async () => {
    clearAuthSession();
    media = Object.assign(new EventTarget(), {
      matches: true,
      media: '(min-width: 1024px)',
    }) as MediaQueryList;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value() {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value() {
          this.open = false;
        },
      },
    });
    getMock.mockReset().mockImplementation(
      async (url) =>
        ({
          status: 200,
          data:
            url === '/v1/trading'
              ? { result: true, data: [] }
              : { result: true, data: { member, address: null, isTrusted: false } },
        }) as ApiResponse,
    );
    profileGetMock.mockReset().mockResolvedValue({
      data: {
        result: true,
        data: { member: { ...member, isKYC: 1 }, address: null, isTrusted: false },
      },
    } as ApiResponse);
    summaryGetMock.mockReset().mockResolvedValue({
      data: {
        result: true,
        data: {
          demo: { current: 0, max: 7, remaining: 7, limitType: 'count' },
          live: { current: 2, max: 5, remaining: 3, limitType: 'count' },
        },
      },
    } as ApiResponse);
    sessionsGetMock.mockReset().mockResolvedValue({ data: { result: true, data: [] } } as ApiResponse);
    vi.spyOn(api, 'get').mockImplementation((url, config) => {
      if (url === '/v1/member/profile') return profileGetMock(url);
      if (url === '/v1/wallet/account-summary') return summaryGetMock(url, config);
      if (url === '/v1/verify/kyc') {
        return Promise.resolve({ data: { result: true, data: { kyc_stat: 1 } } } as ApiResponse);
      }
      if (url === '/v1/auth/sessions/active') return sessionsGetMock(url);
      if (url === '/v1/member/referral-link') {
        return Promise.resolve({ data: { result: true, data: { referralLink: '' } } } as ApiResponse);
      }
      return getMock(url, ...(config ? [config] : []));
    });
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    harness?.fixture.destroy();
    clearAuthSession();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function open(url = '/dashboard'): Promise<PortalLayout> {
    setAuthSession(session);
    const layout = await harness.navigateByUrl(url, PortalLayout);
    await harness.fixture.whenStable();
    return layout;
  }

  async function openUserMenu(element = harness.routeNativeElement!) {
    const trigger = element.querySelector<HTMLButtonElement>(
      'app-navbar button[aria-label="User menu"]',
    );
    expect(trigger).not.toBeNull();
    trigger!.click();
    await harness.fixture.whenStable();
    return trigger!;
  }

  it('shows the signed-in member in the navbar menu and dismisses it with Escape or an outside click', async () => {
    const signedInMember = { ...member, m_image_url: '/avatar.png', m_username: '356154' };
    setAuthSession({ ...session, member: signedInMember });
    await harness.navigateByUrl('/dashboard', PortalLayout);
    const element = harness.routeNativeElement!;
    expect(element.querySelector('#user-menu')).toBeNull();

    const trigger = await openUserMenu(element);
    const menu = element.querySelector('#user-menu')!;
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe('svg/icon/user-outline.svg');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.querySelector('img')?.getAttribute('src')).toBe('/avatar.png');
    expect(menu.textContent).toContain('Test');
    expect(menu.textContent).toContain('#356154');

    const link = menu.querySelector('a')!;
    link.focus();
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#user-menu')).toBeNull();

    await openUserMenu(element);
    element.querySelector<HTMLElement>('.navbar-title')!.click();
    await harness.fixture.whenStable();
    expect(element.querySelector('#user-menu')).toBeNull();
  });

  it.each([
    ['USER INFO', '/user-info'],
    ['KYC VERIFICATION', '/user/verify'],
    ['BANK ACCOUNT', '/user-info/bank-account'],
  ])('navigates from the navbar menu item %s to %s', async (label, url) => {
    await open();
    const element = harness.routeNativeElement!;
    await openUserMenu(element);
    const link = [...element.querySelectorAll<HTMLAnchorElement>('#user-menu a')].find(
      (anchor) => anchor.textContent?.trim() === label,
    );
    expect(link).toBeDefined();
    link!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(url);
    expect(element.querySelector('#user-menu')).toBeNull();
    expect(element.querySelector('app-chang-password')).toBeNull();
  });

  it('opens and reopens the existing password dialog at /user-info from the navbar', async () => {
    await open();
    const element = harness.routeNativeElement!;
    const dialog = () => element.querySelector('app-user-info app-chang-password dialog[open]');
    expect(dialog()).toBeNull();

    for (let attempt = 0; attempt < 2; attempt++) {
      await openUserMenu(element);
      const action = [...element.querySelectorAll<HTMLButtonElement>('#user-menu button')].find(
        (button) => button.textContent?.trim() === 'CHANGE PASSWORD',
      );
      expect(action).toBeDefined();
      action!.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/user-info');
      expect(element.querySelector('#user-menu')).toBeNull();
      expect(dialog()?.querySelector('form[aria-label="Change password"]')).toBeTruthy();
      dialog()!.dispatchEvent(new Event('cancel', { cancelable: true }));
      await harness.fixture.whenStable();
      expect(dialog()).toBeNull();
    }
  });

  it('confirms logout from the navbar with the remembered-device option', async () => {
    setAuthSession({ ...session, twoFaEnabled: true, rememberDevice: true });
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      status: 200,
      data: { result: true },
    } as ApiResponse);
    await harness.navigateByUrl('/dashboard', PortalLayout);
    const element = harness.routeNativeElement!;
    await openUserMenu(element);
    const logout = element.querySelector<HTMLButtonElement>('#user-menu button[aria-label="Logout"]');
    expect(logout).not.toBeNull();
    logout!.click();
    await harness.fixture.whenStable();

    expect(element.querySelector('#user-menu')).toBeNull();
    expect(post).not.toHaveBeenCalled();
    const dialog = element.querySelector('app-logout-confirmation dialog[open]');
    const checkbox = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    checkbox!.click();
    await harness.fixture.whenStable();
    dialog!.querySelector<HTMLButtonElement>('app-button button')!.click();
    await harness.fixture.whenStable();

    expect(post).toHaveBeenCalledExactlyOnceWith('/v1/auth/sessions/logout', {}, {
      validateStatus: expect.any(Function),
    });
    expect(getAuthSession()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it.each(protectedUrls)(
    'redirects a direct unauthenticated visit to %s before rendering private content',
    async (url) => {
      await harness.navigateByUrl(url, Login);
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeNativeElement!.querySelector('app-sidebar')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('app-dashboard')).toBeNull();
      expect(getMock).not.toHaveBeenCalled();
    },
  );

  it('redirects signed-out visitors away from MT5 & Wallet', async () => {
    await harness.navigateByUrl('/mt5-wallet', Login);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('blocks a direct wallet visit when the profile has not passed KYC', async () => {
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: { ...member, isKYC: 0 } } },
    } as ApiResponse);
    setAuthSession({ ...session, member: { ...member, isKYC: 1 } });
    await harness.navigateByUrl('/mt5-wallet', PortalLayout);
    await harness.fixture.whenStable();

    const element = harness.routeNativeElement!;
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element.querySelector('app-mt5-wallet')).toBeNull();
    expect(element.querySelector('#wallet-kyc-dialog[open]')).not.toBeNull();
    expect(profileGetMock).toHaveBeenCalledWith('/v1/member/profile');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('opens the KYC popup from the wallet menu, can close it, and confirms via User verify', async () => {
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { id: member.id, isKYC: 0 } },
    } as ApiResponse);
    await open();
    const element = harness.routeNativeElement!;
    const walletLink = element.querySelector<HTMLAnchorElement>('a[aria-label="MT5 & Wallet"]')!;
    const popup = () => element.querySelector<HTMLDialogElement>('#wallet-kyc-dialog[open]');
    const clickPopupButton = (label: string) =>
      [...popup()!.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === label)!
        .click();

    walletLink.click();
    await vi.waitFor(() => expect(popup()).not.toBeNull());
    clickPopupButton('Close');
    await harness.fixture.whenStable();
    expect(popup()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/dashboard');

    walletLink.click();
    await vi.waitFor(() => expect(popup()).not.toBeNull());
    clickPopupButton('Confirm identity');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/user/verify');
    expect(popup()).toBeNull();

    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: { ...member, isKYC: 1 } } },
    } as ApiResponse);
    await harness.navigateByUrl('/mt5-wallet', PortalLayout);
    expect(harness.routeNativeElement!.querySelector('app-mt5-wallet')).not.toBeNull();
  });

  it('blocks wallet access when the profile cannot be loaded', async () => {
    profileGetMock.mockRejectedValue(new Error('Profile unavailable'));
    await open('/mt5-wallet');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('#wallet-kyc-dialog[open]')?.textContent).toContain(
      'Unable to check identity verification',
    );
    expect(element.querySelector('app-mt5-wallet')).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it.each([true, false, 2])('blocks wallet access for unsupported KYC status %s', async (isKyc) => {
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: { ...member, isKyc } } },
    } as ApiResponse);
    await open('/mt5-wallet');

    const element = harness.routeNativeElement!;
    expect(element.querySelector('#wallet-kyc-dialog[open]')?.textContent).toContain(
      'Unable to check identity verification',
    );
    expect(element.querySelector('app-mt5-wallet')).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('blocks the create request and opens the KYC popup if verification changes after entry', async () => {
    getMock.mockImplementation(
      async (url) =>
        ({
          data: { result: true, data: url === '/v1/trading' ? [] : { leverages: [100] } },
        }) as ApiResponse,
    );
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('Unexpected POST'));
    await open('/mt5-wallet');
    const element = harness.routeNativeElement!;
    await vi.waitFor(() => expect(element.textContent).toContain('No accounts found.'));
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Open Demo Account')!
      .click();
    await harness.fixture.whenStable();
    const dialog = element.querySelector<HTMLDialogElement>('#create-wallet-dialog')!;
    const selectOption = (name: string) => {
      const select = dialog.querySelector<HTMLSelectElement>(`select[formControlName="${name}"]`)!;
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select;
    };
    selectOption('accountType');
    await vi.waitFor(() =>
      expect(
        dialog.querySelector('select[formControlName="leverage"] option:nth-child(2)')?.textContent,
      ).toBe('1:100'),
    );
    selectOption('leverage');
    dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: { ...member, isKyc: 0 } } },
    } as ApiResponse);
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    await vi.waitFor(() =>
      expect(element.querySelector('#wallet-kyc-dialog[open]')).not.toBeNull(),
    );
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element.querySelector('app-mt5-wallet')).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    {
      mode: 'Demo',
      type: 'demo',
      leverage: 500,
      options: [1, 10, 20, 50, 100, 200, 300, 500],
      option: 2,
      name: '',
      limit: 'Limit: 0/7',
    },
    {
      mode: 'Live',
      type: 'live',
      leverage: 2000,
      options: [50, 100, 200, 500, 777, 1000, 2000],
      option: 4,
      name: 'My live account',
      limit: 'Wallet Limit: 2/5',
    },
  ] as const)('creates a $mode wallet and reloads the account list', async (entry) => {
    const createdWallet = {
      id: 1,
      wallet_account_name: 'New account',
      wallet_account_no: '0001',
      wallet_type: 'trading',
      wallet_trading_type: entry.type,
      wallet_balance: 0,
      wallet_status: 1,
    };
    getMock
      .mockResolvedValueOnce({ data: { result: true, data: [] } } as ApiResponse)
      .mockResolvedValueOnce({
        data: { result: true, data: { leverages: entry.options } },
      } as ApiResponse)
      .mockResolvedValueOnce({ data: { result: true, data: [createdWallet] } } as ApiResponse);
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { result: true, data: { wallet: createdWallet } },
    } as ApiResponse);

    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.textContent).toContain('No accounts found.'));
    const openButton = [...page.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === `Open ${entry.mode} Account`,
    )!;
    openButton.click();
    await harness.fixture.whenStable();
    const dialog = page.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe(`Open ${entry.mode} Account`);
    await vi.waitFor(() => expect(dialog.textContent).toContain(entry.limit));
    expect(summaryGetMock.mock.calls.map(([url]) => url)).toEqual(['/v1/wallet/account-summary']);
    const select = dialog.querySelector<HTMLSelectElement>('[formControlName="accountType"]')!;
    expect([...select.options].slice(1).map(({ text }) => text)).toEqual([
      'Real',
      'PoxPrime DEMO',
      'Demo Forex',
      'Standard',
    ]);
    select.selectedIndex = entry.option;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const name = dialog.querySelector<HTMLInputElement>('input[type="text"]:not([readonly])')!;
    name.value = entry.name;
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    expect(submit.disabled).toBe(true);

    const leverage = dialog.querySelector<HTMLSelectElement>('[formControlName="leverage"]')!;
    await vi.waitFor(() =>
      expect([...leverage.options].slice(1).map(({ text }) => text)).toEqual(
        entry.options.map((value) => `1:${value}`),
      ),
    );
    leverage.selectedIndex = [...leverage.options].findIndex(
      ({ text }) => text === `1:${entry.leverage}`,
    );
    leverage.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
    submit.click();

    await vi.waitFor(() =>
      expect(page.querySelector('article h3')?.textContent).toBe('New account'),
    );
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/v1/wallet/user/add',
      {
        wallet_account_type: entry.option,
        wallet_trading_type: entry.type,
        wallet_leverage: entry.leverage,
        wallet_account_name: entry.name,
      },
      { timeout: 45_000 },
    );
    expect(page.querySelector('dialog')).toBeNull();
    expect(getMock.mock.calls.map(([url]) => url)).toEqual([
      '/v1/trading',
      `/v1/trading/wallet-type/${entry.option}/leverages`,
      '/v1/trading',
    ]);
  });

  it.each([
    {
      label: 'API rejection',
      error: new ApiError('Bad Request', {
        status: 400,
        data: { error: { message: 'The selected account type is unavailable.' } },
      } as ApiResponse),
      message: 'The selected account type is unavailable.',
      unconfirmed: false,
    },
    {
      label: 'timeout',
      error: new ApiError('Timeout'),
      message: 'Could not confirm whether the account was opened.',
      unconfirmed: true,
    },
  ])('keeps the form open after a $label and prevents duplicate submission', async (entry) => {
    summaryGetMock.mockRejectedValueOnce(new Error('Summary unavailable'));
    getMock
      .mockResolvedValue({ data: { result: true, data: [] } } as ApiResponse)
      .mockResolvedValueOnce({ data: { result: true, data: [] } } as ApiResponse)
      .mockResolvedValueOnce({
        data: { result: true, data: { leverages: [50, 100] } },
      } as ApiResponse);
    let rejectRequest!: (error: ApiError) => void;
    const request = new Promise<ApiResponse>((_, reject) => (rejectRequest = reject));
    const post = vi.spyOn(api, 'post').mockReturnValue(request);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.textContent).toContain('No accounts found.'));
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Open Live Account')!
      .click();
    await harness.fixture.whenStable();
    const dialog = page.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Wallet Limit: —');
    const select = dialog.querySelector<HTMLSelectElement>('[formControlName="accountType"]')!;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const leverage = dialog.querySelector<HTMLSelectElement>('[formControlName="leverage"]')!;
    await vi.waitFor(() => expect(leverage.options[2]?.text).toBe('1:100'));
    leverage.selectedIndex = 2;
    leverage.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();

    const submit = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.click();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    rejectRequest(entry.error);

    await vi.waitFor(() =>
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(entry.message),
    );
    expect(dialog.open).toBe(true);
    expect(select.selectedIndex).toBe(1);
    expect(submit.disabled).toBe(entry.unconfirmed);
    expect(getMock).toHaveBeenCalledTimes(2);
    if (entry.unconfirmed) {
      dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
      await harness.fixture.whenStable();
      expect(page.querySelector('dialog')).toBeNull();
      expect(getMock).toHaveBeenCalledTimes(3);
    }
  });

  it('keeps grid tabs independent of the table type filter and shows inactive rows as read-only', async () => {
    await open();
    const element = harness.routeNativeElement!;
    const wallet = (id: number, name: string, type: string, tradingType: string, status = 1) => ({
      id,
      memberId: member.id,
      member_id: member.id,
      wallet_account_name: name,
      wallet_type: type,
      wallet_trading_type: tradingType,
      wallet_account_no: `000${id}`,
      wallet_balance: id === 3 ? 250.5 : 0,
      wallet_credit: id === 1 ? 12.5 : null,
      wallet_currency: id === 1 ? 'USC' : null,
      balance: 999,
      wallet_leverage: 100,
      status: 1,
      wallet_status: status,
      createdAt: '2026-11-07T00:00:00Z',
      updatedAt: '2026-11-07T00:00:00Z',
    });
    getMock.mockResolvedValueOnce({
      status: 200,
      data: {
        result: true,
        message: '',
        data: [
          wallet(1, 'Live Alpha', 'trading', ' LIVE '),
          wallet(2, 'Funded Beta', 'trading', 'funded'),
          wallet(5, 'Archived Wallet', 'main', 'inactive', 0),
          wallet(3, 'Main Gamma', 'main', 'wallet'),
          wallet(4, 'Closed Delta', 'trading', 'live', 0),
          wallet(6, 'Deleted Wallet', 'trading', 'deleted', 2),
          wallet(7, 'Uncategorized', 'trading', '', 0),
          wallet(8, 'Funded Echo', 'trading', ' FUNDED '),
          wallet(9, 'Points', 'point', 'point'),
          wallet(10, 'Lots', 'lot', 'lot', 0),
          wallet(11, 'Rebase', 'rebase', 'rebase'),
          wallet(12, 'Deleted Main', 'main', 'wallet', 2),
          wallet(13, 'Live Bonus', 'bonus', 'live'),
          wallet(14, 'Demo Bonus', 'bonus', 'demo'),
          wallet(15, 'Demo Account', 'trading', 'demo'),
          wallet(16, 'Other Category', 'bonus', 'other'),
        ],
      },
    } as ApiResponse);

    const link = element.querySelector<HTMLAnchorElement>('a[aria-label="MT5 & Wallet"]');
    expect(link).not.toBeNull();
    link!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/mt5-wallet');
    expect(link!.getAttribute('aria-current')).toBe('page');
    expect(element.querySelector('.navbar-title')?.textContent).toContain('MT5 & Wallet');
    const walletPage = element.querySelector('app-mt5-wallet')!;
    expect(walletPage.textContent).toContain('250.50 USD');
    expect(element.querySelector('.balance-summary strong')?.textContent?.trim()).toBe('$250.50');
    const tabButtons = walletPage.querySelectorAll('[aria-label="Account type"] button');
    expect([...tabButtons].map((button) => button.textContent?.trim())).toEqual([
      'All',
      'Live',
      'Funded',
      'Demo',
      'Wallet',
      'Inactive',
    ]);
    expect(tabButtons[0].getAttribute('aria-pressed')).toBe('true');
    const click = async (label: string) => {
      [...walletPage.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await harness.fixture.whenStable();
    };
    const visibleCards = () =>
      [...walletPage.querySelectorAll('app-wallet-account-card h3')].map((title) =>
        title.textContent?.trim(),
      );
    const mainWallet = () => walletPage.querySelector('app-main-wallet');

    expect(visibleCards()).toEqual(['Live Alpha', 'Funded Beta', 'Funded Echo', 'Demo Account']);
    expect(mainWallet()?.textContent).toContain('$250.50');
    expect(walletPage.querySelector('app-main-wallet, app-wallet-account-card')).toBe(mainWallet());
    await click('Wallet');
    expect(mainWallet()?.textContent).toContain('$250.50');
    expect(visibleCards()).toEqual([]);
    expect(walletPage.textContent).not.toContain('No accounts found.');
    await click('All');
    expect(walletPage.textContent).toContain('$0');
    for (const [label, names] of [
      ['Live', ['Live Alpha']],
      ['Funded', ['Funded Beta', 'Funded Echo']],
      ['Demo', ['Demo Account']],
      ['Inactive', ['Closed Delta', 'Uncategorized']],
    ] as const) {
      await click(label);
      expect(visibleCards()).toEqual(names);
      expect(mainWallet()).toBeNull();
    }
    for (const card of walletPage.querySelectorAll('article')) {
      expect([...card.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
      card.click();
    }
    await harness.fixture.whenStable();
    expect(walletPage.querySelector('app-card-wallet')).toBeNull();
    await click('Table View');
    expect(walletPage.querySelector('[aria-label="Account type"] button')).toBeNull();
    expect(mainWallet()).toBeNull();
    const table = walletPage.querySelector('table')!;
    expect(table.tBodies[0].rows).toHaveLength(5);
    expect(table.textContent).toContain('12.50 USC');
    expect(table.textContent).not.toContain('Closed Delta');
    expect(table.textContent).not.toContain('Uncategorized');
    expect(table.textContent).not.toContain('Live Bonus');
    expect(table.textContent).not.toContain('Demo Bonus');
    expect(table.textContent).not.toContain('Deleted Wallet');

    const filter = walletPage.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by account type"]',
    )!;
    const selectType = async (type: string) => {
      filter.value = type;
      filter.dispatchEvent(new Event('change'));
      await harness.fixture.whenStable();
    };
    await selectType('inactive');
    expect(table.tBodies[0].rows).toHaveLength(2);
    expect(table.textContent).toContain('0004');
    expect(table.textContent).not.toContain('Live Alpha');
    expect(table.querySelector('tbody button')).toBeNull();
    table.tBodies[0].rows[0].click();
    await harness.fixture.whenStable();
    expect(walletPage.querySelector('app-card-wallet')).toBeNull();
    await selectType('wallet');
    expect(table.tBodies[0].rows).toHaveLength(1);
    expect(table.textContent).toContain('Main Gamma');
    table.querySelector<HTMLButtonElement>('tbody button')!.click();
    await harness.fixture.whenStable();
    expect(walletPage.querySelector('app-main-wallet-card dialog[open]')).not.toBeNull();
    await click('Grid View');
    expect(visibleCards()).toEqual(['Closed Delta', 'Uncategorized']);
    expect(walletPage.querySelector('table')).toBeNull();
    expect(walletPage.querySelector('input[type="search"]')).toBeNull();
    expect(getMock.mock.calls).toEqual([['/v1/trading'], ['/v1/trading']]);
  });

  it('searches all table pages by name and number and combines search with the type filter', async () => {
    const accounts = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      wallet_account_name: index === 11 ? 'Last Account' : `Account ${index + 1}`,
      wallet_account_no: `000${index + 1}`,
      wallet_type: 'trading',
      wallet_trading_type: index === 11 ? 'demo' : 'live',
      wallet_status: 1,
    }));
    getMock.mockResolvedValueOnce({
      status: 200,
      data: { result: true, data: accounts },
    } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Table View')!
      .click();
    await harness.fixture.whenStable();

    const rows = () => page.querySelectorAll('tbody tr');
    expect(rows()).toHaveLength(10);
    page.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await harness.fixture.whenStable();
    expect(rows()).toHaveLength(2);
    expect(page.textContent?.replace(/\s+/g, ' ')).toContain('Showing 11-12 of 12');

    const search = page.querySelector<HTMLInputElement>('input[type="search"]')!;
    const searchFor = async (query: string) => {
      search.value = query;
      search.dispatchEvent(new Event('input'));
      await harness.fixture.whenStable();
    };
    await searchFor('  LAST account  ');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('00012');
    await searchFor('00012');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Last Account');

    const filter = page.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by account type"]',
    )!;
    filter.value = 'live';
    filter.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(page.textContent).toContain('No accounts found.');

    await searchFor('');
    expect(rows()).toHaveLength(10);
    expect(page.textContent?.replace(/\s+/g, ' ')).toContain('Showing 1-10 of 11');
  });

  it('opens wallet details by account number and reveals each password only on request', async () => {
    const wallet = {
      id: 7,
      wallet_account_no: '000738475',
      wallet_account_name: 'Trading account',
      wallet_type: 'trading',
      wallet_trading_type: 'live',
      wallet_account_type: 4,
      wallet_status: 1,
      member_id: 14966,
      wallet_balance: 98000.07,
      wallet_currency: 'USC',
      wallet_master_password: 'master-example',
      wallet_investor_password: 'investor-example',
      wallet_credit: 5,
      wallet_equity: 98000,
      wallet_margin: 12.5,
      wallet_leverage: 1000,
    };
    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: [wallet] },
      } as ApiResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet } },
      } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
    const card = page.querySelector('article')!;
    for (const label of ['Deposit', 'Withdraw']) {
      const button = [...card.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
      );
      expect(button?.disabled).toBe(true);
    }
    card.click();
    await harness.fixture.whenStable();

    expect(getMock).toHaveBeenLastCalledWith('/v1/wallet/user/000738475', expect.anything());
    const dialog = page.querySelector<HTMLDialogElement>('app-card-wallet dialog')!;
    expect(dialog.open).toBe(true);
    await vi.waitFor(() => expect(dialog.textContent).toContain('#14966'));
    for (const value of ['Test Member', '#14966', '98,000.07', '12.50', '1:1000', 'USC']) {
      expect(dialog.textContent).toContain(value);
    }
    expect(dialog.textContent).not.toContain('master-example');
    expect(dialog.textContent).not.toContain('investor-example');
    const reveal = (label: string) =>
      dialog.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
    reveal('Show master password');
    await harness.fixture.whenStable();
    expect(dialog.textContent).toContain('master-example');
    expect(dialog.textContent).not.toContain('investor-example');
    reveal('Hide master password');
    reveal('Show investor password');
    await harness.fixture.whenStable();
    expect(dialog.textContent).not.toContain('master-example');
    expect(dialog.textContent).toContain('investor-example');
    for (const label of ['Deposit', 'Withdraw/Transfer', 'Transaction History']) {
      const button = [...dialog.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
      );
      expect(button?.disabled).toBe(true);
    }
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await harness.fixture.whenStable();
    expect(page.querySelector('app-card-wallet')).toBeNull();
  });

  async function openDemoDeposit(from: 'wallet details' | 'Add Balance' = 'wallet details') {
    const wallet = {
      id: 7,
      wallet_account_name: 'MT5-000793315',
      wallet_account_no: '000793315',
      wallet_type: 'trading',
      wallet_trading_type: 'demo',
      wall_account_type: '2',
      wallet_balance: 500,
      wallet_status: 1,
    };
    getMock
      .mockResolvedValueOnce({ data: { result: true, data: [wallet] } } as ApiResponse)
      .mockResolvedValueOnce({ data: { result: true, data: { wallet } } } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
    const card = page.querySelector('article')!;
    if (from === 'Add Balance') {
      const addBalance = [...card.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Add Balance',
      );
      expect(addBalance?.disabled).toBe(false);
      addBalance!.click();
    } else {
      card.click();
    }
    await harness.fixture.whenStable();
    const details = page.querySelector<HTMLDialogElement>('app-card-wallet > dialog')!;
    if (from === 'wallet details') {
      const depositButton = () =>
        [...details.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === 'Deposit',
        );
      await vi.waitFor(() => expect(depositButton()?.disabled).toBe(false));
      depositButton()!.click();
      await harness.fixture.whenStable();
    }
    const deposit = await vi.waitFor(() => {
      const dialog = page.querySelector<HTMLDialogElement>('app-deposit-demo dialog');
      expect(dialog?.open).toBe(true);
      expect(dialog?.querySelector('form')).not.toBeNull();
      return dialog!;
    });
    const button = (label: string) =>
      [...deposit.querySelectorAll<HTMLButtonElement>('app-button button')].find(
        (item) => item.textContent?.trim() === label,
      )!;
    return { wallet, page, details, deposit, button };
  }

  it.each(['Cancel', 'Close deposit', 'Escape'])(
    'returns to the same wallet without depositing when dismissed with %s',
    async (action) => {
      const post = vi.spyOn(api, 'post');
      const { page, details, deposit, button } = await openDemoDeposit();
      if (action === 'Escape') {
        deposit.dispatchEvent(new Event('cancel', { cancelable: true }));
      } else {
        button(action).click();
      }
      await harness.fixture.whenStable();
      expect(page.querySelector('app-deposit-demo')).toBeNull();
      expect(page.querySelector('app-card-wallet > dialog')).toBe(details);
      expect(details.open).toBe(true);
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('opens only the deposit dialog from Add Balance and returns to the grid on cancel', async () => {
    const post = vi.spyOn(api, 'post');
    const { page, deposit, button } = await openDemoDeposit('Add Balance');
    expect(page.querySelector('app-card-wallet')).toBeNull();
    expect(page.querySelector('dialog[open]')).toBe(deposit);

    button('Cancel').click();
    await harness.fixture.whenStable();
    expect(page.querySelector('dialog')).toBeNull();
    expect(page.querySelector('article h3')?.textContent).toBe('MT5-000793315');
    expect(post).not.toHaveBeenCalled();
  });

  it('opens the existing live account dialog from the demo wallet card', async () => {
    const wallet = {
      id: 7,
      wallet_account_name: 'Demo wallet',
      wallet_account_no: '000793315',
      wallet_type: 'trading',
      wallet_trading_type: 'demo',
      wallet_balance: 500,
      wallet_status: 1,
    };
    getMock.mockResolvedValueOnce({ data: { result: true, data: [wallet] } } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
    const openLive = [...page.querySelectorAll<HTMLButtonElement>('article button')].find(
      (button) => button.textContent?.trim() === 'Open Live',
    );
    expect(openLive?.disabled).toBe(false);
    openLive!.click();
    await harness.fixture.whenStable();
    const dialog = page.querySelector<HTMLDialogElement>('app-create-account dialog');
    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector('h2')?.textContent?.trim()).toBe('Open Live Account');
    expect(page.querySelector('app-card-wallet')).toBeNull();
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it.each(['wallet details', 'Add Balance'] as const)(
    'deposits the selected demo investment once from %s and reloads wallet balances',
    async (from) => {
      let finish!: (value: ApiResponse) => void;
      const post = vi.spyOn(api, 'post').mockImplementation(
        () =>
          new Promise<ApiResponse>((resolve) => {
            finish = resolve;
          }),
      );
      const { wallet, page, details, deposit, button } = await openDemoDeposit(from);
      const accountFields = [...deposit.querySelectorAll<HTMLInputElement>('app-input input')];
      expect(accountFields.map((input) => input.value)).toEqual([
        'MT5-000793315',
        '000793315',
        'PoxPrime DEMO',
      ]);
      expect(accountFields.every((input) => input.disabled)).toBe(true);
      const investment = deposit.querySelector('select')!;
      expect(investment.disabled).toBe(false);
      expect([...investment.options].map((option) => option.textContent?.trim())).toEqual([
        '$100',
        '$1,000',
        '$10,000',
        '$100,000',
      ]);
      expect(investment.value).toBe('100');
      investment.value = '10000';
      investment.dispatchEvent(new Event('change', { bubbles: true }));
      await harness.fixture.whenStable();
      expect(post).not.toHaveBeenCalled();

      const updated = { ...wallet, wallet_balance: 10_500 };
      getMock.mockImplementation(
        async (url) =>
          ({
            data: { result: true, data: url === '/v1/trading' ? [updated] : { wallet: updated } },
          }) as ApiResponse,
      );
      const confirm = button('Confirm');
      confirm.click();
      confirm.click();
      harness.fixture.detectChanges();
      expect(post).toHaveBeenCalledExactlyOnceWith('/v1/wallet/trade/balance/000793315/deposit', {
        balance: 10_000,
        comment: 'Deposit',
      });
      expect(confirm.disabled).toBe(true);
      finish({ data: { result: true, data: { wallet: [updated] } } } as ApiResponse);
      await vi.waitFor(() => {
        expect(page.querySelector('app-deposit-demo')).toBeNull();
        if (from === 'wallet details') {
          expect(details.open).toBe(true);
          expect(details.textContent).toContain('10,500.00');
        } else {
          expect(page.querySelector('dialog')).toBeNull();
          expect(page.querySelector('article')?.textContent).toContain('10,500.00');
        }
      });
      expect(getMock.mock.calls.filter(([url]) => url === '/v1/trading')).toHaveLength(2);
    },
  );

  it('keeps the deposit form open after a rejected deposit', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { result: false, message: 'Deposit rejected.' },
    } as ApiResponse);
    const { deposit, button } = await openDemoDeposit();
    button('Confirm').click();
    await vi.waitFor(() => {
      expect(deposit.open).toBe(true);
      expect(deposit.querySelector('[role="alert"]')?.textContent).toContain('Deposit rejected.');
      expect(button('Confirm').disabled).toBe(false);
    });
  });

  it('refreshes the balance before allowing another deposit after a lost response', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('Connection lost'));
    const { wallet, details, deposit, button } = await openDemoDeposit();
    button('Confirm').click();
    await harness.fixture.whenStable();
    expect(deposit.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');
    expect(button('Confirm').disabled).toBe(true);

    const updated = { ...wallet, wallet_balance: 600 };
    getMock
      .mockResolvedValueOnce({ data: { result: true, data: { wallet: updated } } } as ApiResponse)
      .mockResolvedValueOnce({ data: { result: true, data: [updated] } } as ApiResponse);
    button('Cancel').click();
    await vi.waitFor(() => expect(details.textContent).toContain('600.00'));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each(['main', 'point', 'lot', 'rebase', ''])(
    'does not offer deletion when wallet details have type %s',
    async (type) => {
      const wallet = {
        id: 7,
        wallet_account_no: '000738475',
        wallet_type: 'trading',
        wallet_status: 1,
      };
      const remove = vi.spyOn(api, 'delete');
      getMock
        .mockResolvedValueOnce({ data: { result: true, data: [wallet] } } as ApiResponse)
        .mockResolvedValueOnce({
          data: { result: true, data: { wallet: { ...wallet, wallet_type: type } } },
        } as ApiResponse);
      await open('/mt5-wallet');
      const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
      await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
      page.querySelector<HTMLElement>('article')!.click();
      await vi.waitFor(() =>
        expect(page.querySelector('[aria-label="Wallet overview"]')).not.toBeNull(),
      );
      expect(page.querySelector('[aria-label="Delete account"]')).toBeNull();
      expect(page.querySelector('app-alert-card')).toBeNull();
      expect(remove).not.toHaveBeenCalled();
    },
  );

  async function openDeleteWallet() {
    const wallet = {
      id: 7,
      wallet_account_no: '000738475',
      wallet_account_name: 'Trading account',
      wallet_type: 'trading',
      wallet_trading_type: 'live',
      wallet_balance: 0,
      wallet_status: 1,
    };
    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: [wallet] },
      } as ApiResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet } },
      } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
    page.querySelector<HTMLElement>('article')!.click();
    await harness.fixture.whenStable();
    const details = page.querySelector<HTMLDialogElement>('app-card-wallet > dialog')!;
    await vi.waitFor(() =>
      expect(details.querySelector('[aria-label="Wallet overview"]')).not.toBeNull(),
    );
    const trash = details.querySelector<HTMLButtonElement>('[aria-label="Delete account"]');
    expect(trash).not.toBeNull();
    trash!.click();
    await harness.fixture.whenStable();
    const confirmation = page.querySelector<HTMLDialogElement>('app-alert-card dialog')!;
    expect(confirmation.open).toBe(true);
    const button = (label: string) =>
      [...confirmation.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
      )!;
    return { page, details, confirmation, button };
  }

  it.each(['Cancel', 'Close', 'Escape'])(
    'keeps wallet details open without deleting when confirmation is dismissed with %s',
    async (action) => {
      const remove = vi.spyOn(api, 'delete');
      const { page, details, confirmation, button } = await openDeleteWallet();
      expect(remove).not.toHaveBeenCalled();
      if (action === 'Escape') {
        confirmation.dispatchEvent(new Event('cancel', { cancelable: true }));
      } else if (action === 'Close') {
        confirmation.querySelector<HTMLButtonElement>('[aria-label="Cancel deletion"]')!.click();
      } else {
        button('Cancel').click();
      }
      await harness.fixture.whenStable();
      expect(page.querySelector('app-alert-card')).toBeNull();
      expect(details.open).toBe(true);
      expect(page.querySelector('article')).not.toBeNull();
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('deletes the selected wallet only after confirmation and refreshes the list', async () => {
    let finish!: (value: ApiResponse) => void;
    const remove = vi.spyOn(api, 'delete').mockImplementation(
      () =>
        new Promise<ApiResponse>((resolve) => {
          finish = resolve;
        }),
    );
    const { page, details, confirmation, button } = await openDeleteWallet();
    const confirm = button('Yes, delete');
    confirm.click();
    confirm.click();
    // Flush rendering without awaiting the deliberately pending API response.
    harness.fixture.detectChanges();
    expect(remove).toHaveBeenCalledExactlyOnceWith('/v1/wallet/user/000738475');
    expect(confirm.disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    confirmation.dispatchEvent(new Event('cancel', { cancelable: true }));
    harness.fixture.detectChanges();
    expect(confirmation.open).toBe(true);
    expect(details.open).toBe(true);
    finish({ status: 200, data: { result: true, data: {} } } as ApiResponse);
    await vi.waitFor(() => {
      expect(page.querySelector('app-card-wallet')).toBeNull();
      expect(page.querySelector('article')).toBeNull();
      expect(page.textContent).toContain('No accounts found.');
    });
    expect(getMock.mock.calls.filter(([url]) => url === '/v1/trading')).toHaveLength(2);
  });

  it.each(['rejected request', 'unsuccessful result'])(
    'preserves the wallet and allows retry after a %s',
    async (failure) => {
      const remove = vi.spyOn(api, 'delete');
      if (failure === 'rejected request') {
        remove.mockRejectedValueOnce(new Error('Network failed'));
      } else {
        remove.mockResolvedValueOnce({
          status: 200,
          data: { result: false, message: 'Account cannot be deleted.' },
        } as ApiResponse);
      }
      remove.mockResolvedValueOnce({ status: 200, data: { result: true } } as ApiResponse);
      const { page, details, confirmation, button } = await openDeleteWallet();
      button('Yes, delete').click();
      await harness.fixture.whenStable();
      expect(confirmation.querySelector('[role="alert"]')?.textContent?.trim()).toBeTruthy();
      expect(details.open).toBe(true);
      expect(page.querySelector('article')).not.toBeNull();
      expect(button('Yes, delete').disabled).toBe(false);
      button('Yes, delete').click();
      await harness.fixture.whenStable();
      expect(page.querySelector('app-card-wallet')).toBeNull();
      expect(page.querySelector('article')).toBeNull();
      expect(remove).toHaveBeenCalledTimes(2);
    },
  );

  it('opens the existing wallet detail dialog for the selected table row', async () => {
    const first = {
      id: 1,
      wallet_account_no: '0001',
      wallet_account_name: 'First account',
      wallet_type: 'trading',
      wallet_status: 1,
    };
    const selected = {
      id: 2,
      wallet_account_no: '0002',
      wallet_account_name: 'Second account',
      wallet_type: 'trading',
      wallet_status: 1,
    };
    getMock
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: [first, selected] },
      } as ApiResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet: { ...selected, member_id: 14966 } } },
      } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Table View')!
      .click();

    const rows = () => page.querySelectorAll<HTMLTableRowElement>('tbody tr');
    await vi.waitFor(() => expect(rows()).toHaveLength(2));
    rows()[1].click();

    await vi.waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/v1/wallet/user/0002', expect.anything());
      const dialog = page.querySelector<HTMLDialogElement>('app-card-wallet dialog');
      expect(dialog?.open).toBe(true);
      expect(dialog?.textContent).toContain('#0002');
    });
  });

  it('can retry a failed wallet request and displays an empty result', async () => {
    getMock.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce({
      status: 200,
      data: { result: true, message: '', data: [] },
    } as ApiResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => {
      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'Unable to load accounts',
      );
    });
    const retry = [...page.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Retry',
    );
    retry!.click();
    await vi.waitFor(() => expect(page.textContent).toContain('No accounts found.'));
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(
      [...page.querySelectorAll('[aria-label="Account type"] button')].map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['All', 'Wallet', 'Inactive']);
  });

  it('shows the main wallet with an unavailable balance when wallet_balance is missing', async () => {
    getMock.mockResolvedValueOnce({
      status: 200,
      data: {
        result: true,
        message: '',
        data: [
          {
            id: 1,
            memberId: member.id,
            member_id: member.id,
            wallet_account_name: 'Main Wallet',
            wallet_account_no: '0001',
            wallet_type: 'main',
            wallet_trading_type: '',
            wallet_status: 1,
            status: 1,
            wallet_balance: null,
            balance: 999,
            wallet_leverage: 0,
            createdAt: '2026-11-07T00:00:00Z',
            updatedAt: '2026-11-07T00:00:00Z',
          },
        ],
      },
    } as ApiResponse);
    await open('/mt5-wallet');
    const element = harness.routeNativeElement!;
    const page = element.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() =>
      expect(page.querySelector('app-main-wallet')?.textContent).toContain('—'),
    );
    expect(element.querySelector('.balance-summary strong')?.textContent?.trim()).toBe('—');
    expect(page.textContent).not.toContain('No accounts found.');
    expect(page.textContent?.replace(/\s+/g, ' ')).toContain('— USD');
  });

  it.each([
    'invalid-json',
    JSON.stringify({ ...session, accessToken: '' }),
    JSON.stringify({ ...session, require2FA: true }),
  ])('rejects an invalid stored session: %s', async (value) => {
    sessionStorage.setItem('authSession', value);
    await harness.navigateByUrl('/dashboard', Login);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(getAuthSession()).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('opens Dashboard with the shared navbar from / when a session already exists', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        result: true,
        data: [
          {
            wallet_type: 'main',
            wallet_status: 1,
            wallet_balance: 1234.5,
            wallet_credit: 25,
            balance: 999,
          },
          { wallet_type: 'point', wallet_status: 1, wallet_balance: 750, wallet_credit: '125.5' },
          { wallet_type: 'trading', wallet_status: 1, wallet_balance: 2500 },
          { wallet_type: 'point', wallet_status: 0, wallet_balance: 600, wallet_credit: 500 },
        ],
      },
    } as ApiResponse);
    await open('/');
    const element = harness.routeNativeElement!;
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element.querySelector('app-dashboard')).not.toBeNull();
    expect(element.querySelectorAll('app-navbar')).toHaveLength(1);
    expect(element.querySelector('.navbar-title')?.textContent?.trim()).toBe('Dashboard');
    expect(element.querySelector('.deposit-button button:disabled')?.textContent).toContain(
      'Deposit',
    );
    expect(element.querySelector('.account-header')).toBeNull();
    expect(element.querySelector('.account-panel')).toBeNull();
    expect(
      element.querySelector('.navigation-item[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/dashboard');
    expect(element.querySelector('.user-name')?.textContent?.trim()).toBe('Test Member');
    expect(element.querySelector('.user-email')?.textContent?.trim()).toBe(member.email);
    expect(element.querySelectorAll('.navigation-item:disabled')).toHaveLength(11);
    expect(element.querySelectorAll('nav[aria-label="Sidebar"] a')).toHaveLength(3);
    await vi.waitFor(() =>
      expect(element.querySelector('.balance-summary strong')?.textContent?.trim()).toBe('$1,234.50'),
    );
    expect(element.querySelector('.user-details .metric-badge')?.textContent?.trim()).toBe('125.5 GP');
    expect(element.querySelector('app-sidebar svg')).toBeNull();
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it.each(protectedUrls.slice(1))(
    'keeps User Account selected on the direct URL %s',
    async (url) => {
      await open(url);
      const active = harness.routeNativeElement!.querySelectorAll(
        '.navigation-item[aria-current="page"]',
      );
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('href')).toBe('/user-info');
      expect(harness.routeNativeElement!.querySelectorAll('app-navbar')).toHaveLength(1);
      expect(harness.routeNativeElement!.querySelector('.navbar-title')?.textContent?.trim()).toBe(
        'User Account',
      );
    },
  );

  it('keeps sidebar collapse state when switching between Dashboard and User Account', async () => {
    const layout = await open();
    const element = harness.routeNativeElement!;
    element.querySelector<HTMLButtonElement>('[aria-label="Collapse sidebar"]')!.click();
    await harness.fixture.whenStable();
    expect(layout.collapsed()).toBe(true);
    expect(element.querySelector('.portal-page')?.classList.contains('sidebar-collapsed')).toBe(
      true,
    );
    element.querySelector<HTMLAnchorElement>('a[aria-label="User Account"]')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/user-info');
    expect(harness.routeDebugElement!.componentInstance).toBe(layout);
    expect(layout.collapsed()).toBe(true);
    element.querySelector<HTMLAnchorElement>('a[aria-label="Dashboard"]')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(profileGetMock.mock.calls).toEqual([
      ['/v1/member/profile'],
      ['/v1/member/profile'],
      ['/v1/member/profile'],
    ]);
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it('checks child routes again when the session has been removed', async () => {
    await open('/user-info/bank-account');
    sessionStorage.removeItem('authSession');
    await harness.navigateByUrl('/user-info/crypto-wallet', Login);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it.each([
    {
      desktop: true,
      remembered: false,
      endpoint: '/v1/auth/logout',
      body: { forgetDevice: false },
    },
    { desktop: false, remembered: true, endpoint: '/v1/auth/sessions/logout', body: {} },
  ])('confirms logout from the sidebar with desktop=$desktop', async (scenario) => {
    Object.assign(media, { matches: scenario.desktop });
    setAuthSession({ ...session, twoFaEnabled: true, rememberDevice: scenario.remembered });
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      status: 200,
      data: { result: true },
    } as ApiResponse);
    await harness.navigateByUrl('/dashboard', PortalLayout);
    const element = harness.routeNativeElement!;

    if (!scenario.desktop) {
      element.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')!.click();
      await harness.fixture.whenStable();
    }

    const logout = element.querySelector<HTMLButtonElement>(
      'app-sidebar button[aria-label="Logout"]',
    );
    expect(logout).not.toBeNull();
    logout!.click();
    await harness.fixture.whenStable();

    const dialog = element.querySelector<HTMLDialogElement>(
      'app-logout-confirmation dialog[open]',
    )!;
    expect(dialog).toBeTruthy();
    expect(element.querySelector('#navigation-drawer[open]')).toBeNull();
    expect(post).not.toHaveBeenCalled();
    const checkbox = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(!!checkbox).toBe(scenario.remembered);
    checkbox?.click();
    await harness.fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('app-button button')!.click();
    await harness.fixture.whenStable();

    expect(post).toHaveBeenCalledExactlyOnceWith(scenario.endpoint, scenario.body, {
      validateStatus: expect.any(Function),
    });
    expect(getAuthSession()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('removes private content on logout and blocks subsequent direct visits', async () => {
    await open();
    clearAuthSession();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement!.querySelector('app-sidebar')).toBeNull();
    await harness.navigateByUrl('/dashboard', Login);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it.each(['session', 'different-session'])(
    'replaces private Dashboard data when a remembered member changes with UID %s',
    async (sessionUid) => {
      sessionsGetMock.mockImplementation(async () => {
        const current = getAuthSession();
        return {
          data: {
            result: true,
            data: [
              {
                session_uid: current?.sessionUid,
                session_browser: current?.member.id === 1 ? 'Old browser' : 'New browser',
              },
            ],
          },
        } as ApiResponse;
      });
      setAuthSession(session, true);
      await harness.navigateByUrl('/dashboard', PortalLayout);
      await harness.fixture.whenStable();
      const element = harness.routeNativeElement!;
      expect(element.textContent).toContain('Old browser');

      localStorage.setItem(
        'authSession',
        JSON.stringify({ ...session, member: { ...member, id: 2 }, sessionUid }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'authSession' }));
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/dashboard');
      expect(element.textContent).toContain('New browser');
      expect(element.textContent).not.toContain('Old browser');
      expect(element.querySelector('img[alt="Current session"]')).not.toBeNull();
    },
  );

  it('blocks wallet loading when a remembered session switches to an unverified member', async () => {
    setAuthSession(session, true);
    await harness.navigateByUrl('/mt5-wallet', PortalLayout);
    await harness.fixture.whenStable();
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');

    const nextMember = { ...member, id: 2, isKYC: 0 };
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: nextMember } },
    } as ApiResponse);
    localStorage.setItem('authSession', JSON.stringify({ ...session, member: nextMember }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'authSession' }));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(harness.routeNativeElement!.querySelector('a[href="/user/verify"]')).not.toBeNull();
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it('updates the sidebar after a profile save even when reloading the profile fails', async () => {
    setAuthSession(session, true);
    await harness.navigateByUrl('/user-info', PortalLayout);
    await harness.fixture.whenStable();
    const profile = harness.routeDebugElement!.query(By.directive(UserInfo))
      .componentInstance as UserInfo;
    vi.spyOn(api, 'put').mockResolvedValueOnce({
      status: 200,
      data: { result: true, message: 'Saved.' },
    } as ApiResponse);
    profileGetMock.mockRejectedValueOnce(new Error('Reload failed.'));
    await profile.onUpdate({
      member: {
        m_name: 'Updated',
        m_lastname: 'Name',
        m_phone: '0812345678',
        m_country: 'Thailand',
        m_gender: 'male',
      },
      address: {
        address_no: '123',
        address_city: 'Bangkok',
        address_district: 'District',
        address_state: 'Bangkok',
        address_zipcode: '10110',
      },
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('.user-name')?.textContent?.trim()).toBe(
      'Updated Name',
    );
    expect(sessionStorage.getItem('authSession')).toBeNull();
    expect(JSON.parse(localStorage.getItem('authSession')!).member.m_name).toBe('Updated');
    expect(getAuthSession()?.accessToken).toBe(session.accessToken);
  });

  it('refreshes the sidebar avatar after changing the profile image', async () => {
    await open('/user-info');
    profileGetMock.mockResolvedValueOnce({
      status: 200,
      data: {
        result: true,
        data: {
          member: { ...member, m_image_url: '/new-avatar.png' },
          address: null,
          isTrusted: false,
        },
      },
    } as ApiResponse);
    const profile = harness.routeDebugElement!.query(By.directive(UserInfo))
      .componentInstance as UserInfo;
    profile.onImageSaved();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('.user-avatar')?.getAttribute('src')).toBe(
      '/new-avatar.png',
    );
  });

  it('opens the mobile drawer and closes it with Escape, the backdrop, or navigation, restoring focus', async () => {
    Object.assign(media, { matches: false });
    const layout = await open();
    const element = harness.routeNativeElement!;
    const trigger = element.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')!;
    const dialog = element.querySelector('dialog')!;
    expect(element.querySelector('app-navbar')!.contains(trigger)).toBe(true);
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe('svg/icon/menu-glass.svg');
    expect(dialog.querySelector('.toggle-button img')?.getAttribute('src')).toBe('svg/icon/x.svg');
    const focus = vi.spyOn(trigger, 'focus');
    expect(element.querySelector('.desktop-sidebar')).toBeNull();

    trigger.click();
    await harness.fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(false);
    expect(focus).toHaveBeenCalled();

    trigger.click();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: -1 }));
    expect(dialog.open).toBe(false);
    trigger.click();
    dialog.querySelector<HTMLAnchorElement>('a[aria-label="User Account"]')!.click();
    await harness.fixture.whenStable();
    expect(layout.drawerOpen()).toBe(false);
    expect(dialog.open).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/user-info');
  });

  it('closes an open drawer when resizing to desktop', async () => {
    Object.assign(media, { matches: false });
    const layout = await open();
    layout.openDrawer();
    media.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
    await harness.fixture.whenStable();
    expect(layout.drawerOpen()).toBe(false);
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('.desktop-sidebar')).not.toBeNull();
  });
});
