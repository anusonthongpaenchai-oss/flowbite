import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../../../../shared/api/api';
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
            url === '/v1/verify/kyc'
              ? { result: true, data: { kyc_stat: 1 } }
              : { result: true, data: { member, address: null, isTrusted: false } },
        }) as AxiosResponse,
    );
    vi.spyOn(api, 'get').mockImplementation(getMock);
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

  it.each([
    {
      mode: 'Demo',
      type: 'demo',
      leverage: 500,
      options: [1, 10, 20, 50, 100, 200, 300, 500],
      option: 2,
      name: '',
    },
    {
      mode: 'Live',
      type: 'live',
      leverage: 2000,
      options: [50, 100, 200, 500, 777, 1000, 2000],
      option: 4,
      name: 'My live account',
    },
  ] as const)('creates a $mode wallet and reloads the account list', async (entry) => {
    const createdWallet = {
      id: 1,
      wallet_account_name: 'New account',
      wallet_account_no: '0001',
      wallet_type: 'trading',
      wallet_trading_type: entry.type,
      wallet_balance: 0,
    };
    getMock
      .mockResolvedValueOnce({ data: { result: true, data: [] } } as AxiosResponse)
      .mockResolvedValueOnce({
        data: { result: true, data: { leverages: entry.options } },
      } as AxiosResponse)
      .mockResolvedValueOnce({ data: { result: true, data: [createdWallet] } } as AxiosResponse);
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { result: true, data: { wallet: createdWallet } },
    } as AxiosResponse);

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
      error: Object.assign(new AxiosError('Bad Request'), {
        response: {
          status: 400,
          data: { error: { message: 'The selected account type is unavailable.' } },
        },
      }),
      message: 'The selected account type is unavailable.',
      unconfirmed: false,
    },
    {
      label: 'timeout',
      error: new AxiosError('Timeout', AxiosError.ECONNABORTED),
      message: 'Could not confirm whether the account was opened.',
      unconfirmed: true,
    },
  ])('keeps the form open after a $label and prevents duplicate submission', async (entry) => {
    getMock
      .mockResolvedValue({ data: { result: true, data: [] } } as AxiosResponse)
      .mockResolvedValueOnce({ data: { result: true, data: [] } } as AxiosResponse)
      .mockResolvedValueOnce({
        data: { result: true, data: { leverages: [50, 100] } },
      } as AxiosResponse);
    let rejectRequest!: (error: AxiosError) => void;
    const request = new Promise<AxiosResponse>((_, reject) => (rejectRequest = reject));
    const post = vi.spyOn(api, 'post').mockReturnValue(request);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.textContent).toContain('No accounts found.'));
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Open Live Account')!
      .click();
    await harness.fixture.whenStable();
    const dialog = page.querySelector('dialog')!;
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
    expect(post).toHaveBeenCalledTimes(1);
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

  it('builds tabs from the returned trading types and filters both views', async () => {
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
          wallet(1, 'Live Alpha', 'main', ' LIVE ', 0),
          wallet(2, 'Funded Beta', 'main', 'funded'),
          wallet(3, 'Main Gamma', 'main', 'wallet'),
          wallet(4, 'Closed Delta', 'trading', 'inactive'),
          wallet(5, 'Archived Wallet', 'main', 'inactive', 0),
          wallet(6, 'Legacy Wallet', 'trading', 'main'),
          wallet(7, 'Uncategorized', 'main', '', 0),
          wallet(8, 'Funded Echo', 'trading', ' FUNDED '),
        ],
      },
    } as AxiosResponse);

    const link = element.querySelector<HTMLAnchorElement>('a[aria-label="MT5 & Wallet"]');
    expect(link).not.toBeNull();
    link!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/mt5-wallet');
    expect(link!.getAttribute('aria-current')).toBe('page');
    expect(element.querySelector('.navbar-title')?.textContent).toContain('MT5 & Wallet');
    expect(element.textContent).toContain('250.50 USD');
    expect(element.querySelector('.balance-summary')?.textContent).not.toContain('$ 3,000');
    const walletPage = element.querySelector('app-mt5-wallet')!;
    const tabButtons = walletPage.querySelectorAll('[aria-label="Account type"] button');
    expect([...tabButtons].map((button) => button.textContent?.trim())).toEqual([
      'All',
      'Live',
      'Funded',
      'Wallet',
      'Inactive',
      'Main',
    ]);
    expect(tabButtons[0].getAttribute('aria-pressed')).toBe('true');
    const click = async (label: string) => {
      [...walletPage.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === label)!
        .click();
      await harness.fixture.whenStable();
    };
    const visibleCards = () =>
      [...walletPage.querySelectorAll('article h3')].map((title) => title.textContent?.trim());

    expect(visibleCards()).toEqual([
      'Live Alpha',
      'Funded Beta',
      'Main Gamma',
      'Closed Delta',
      'Archived Wallet',
      'Legacy Wallet',
      'Uncategorized',
      'Funded Echo',
    ]);
    expect(walletPage.textContent).toContain('$0');
    for (const [label, names] of [
      ['Live', ['Live Alpha']],
      ['Funded', ['Funded Beta', 'Funded Echo']],
      ['Wallet', ['Main Gamma']],
      ['Main', ['Legacy Wallet']],
      ['Inactive', ['Closed Delta', 'Archived Wallet']],
    ] as const) {
      await click(label);
      expect(visibleCards()).toEqual(names);
    }
    await click('Table View');
    const table = walletPage.querySelector('table')!;
    expect(table.tBodies[0].rows).toHaveLength(2);
    expect(table.textContent).toContain('0004');
    expect(table.textContent).not.toContain('Live Alpha');
    await click('All');
    expect(table.tBodies[0].rows).toHaveLength(8);
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
  });

  it('can retry a failed wallet request and displays an empty result', async () => {
    getMock.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce({
      status: 200,
      data: { result: true, message: '', data: [] },
    } as AxiosResponse);
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
    ).toEqual(['All']);
  });

  it('shows the wallet total as unavailable when a main wallet has no balance', async () => {
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
            balance: null,
            wallet_leverage: 0,
            createdAt: '2026-11-07T00:00:00Z',
            updatedAt: '2026-11-07T00:00:00Z',
          },
        ],
      },
    } as AxiosResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() =>
      expect(page.querySelector('article h3')?.textContent).toBe('Main Wallet'),
    );
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
    await open('/');
    const element = harness.routeNativeElement!;
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element.querySelector('app-dashboard')).not.toBeNull();
    expect(element.querySelectorAll('app-navbar')).toHaveLength(1);
    expect(element.querySelector('.navbar-title')?.textContent?.trim()).toBe('Dashboard');
    expect(element.querySelector('.deposit-button')).toBeNull();
    expect(element.querySelector('.account-header')).toBeNull();
    expect(element.querySelector('.account-panel')).toBeNull();
    expect(
      element.querySelector('.navigation-item[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/dashboard');
    expect(element.querySelector('.user-name')?.textContent?.trim()).toBe('Test Member');
    expect(element.querySelector('.user-email')?.textContent?.trim()).toBe(member.email);
    expect(element.querySelectorAll('.navigation-item:disabled')).toHaveLength(11);
    expect(element.querySelectorAll('nav[aria-label="Sidebar"] a')).toHaveLength(3);
    expect(getMock).not.toHaveBeenCalled();
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
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
  });

  it('checks child routes again when the session has been removed', async () => {
    await open('/user-info/bank-account');
    sessionStorage.removeItem('authSession');
    await harness.navigateByUrl('/user-info/crypto-wallet', Login);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(getMock).not.toHaveBeenCalled();
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

  it('updates the sidebar after a profile save even when reloading the profile fails', async () => {
    setAuthSession(session, true);
    await harness.navigateByUrl('/user-info', PortalLayout);
    await harness.fixture.whenStable();
    const profile = harness.routeDebugElement!.query(By.directive(UserInfo))
      .componentInstance as UserInfo;
    vi.spyOn(api, 'put').mockResolvedValueOnce({
      status: 200,
      data: { result: true, message: 'Saved.' },
    } as AxiosResponse);
    getMock.mockRejectedValueOnce(new Error('Reload failed.'));
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
    getMock.mockResolvedValueOnce({
      status: 200,
      data: {
        result: true,
        data: {
          member: { ...member, m_image_url: '/new-avatar.png' },
          address: null,
          isTrusted: false,
        },
      },
    } as AxiosResponse);
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
