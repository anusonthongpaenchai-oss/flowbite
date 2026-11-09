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
  const profileGetMock = vi.fn<typeof api.get>();

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
              : url === '/v1/trading'
                ? { result: true, data: [] }
                : { result: true, data: { member, address: null, isTrusted: false } },
        }) as AxiosResponse,
    );
    profileGetMock.mockReset().mockResolvedValue({
      data: {
        result: true,
        data: { member: { ...member, isKYC: 1 }, address: null, isTrusted: false },
      },
    } as AxiosResponse);
    vi.spyOn(api, 'get').mockImplementation((url, config) =>
      url === '/v1/member/profile'
        ? profileGetMock(url)
        : getMock(url, ...(config ? [config] : [])),
    );
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

  it('blocks a direct wallet visit when the profile has not passed KYC', async () => {
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { member: { ...member, isKYC: 0 } } },
    } as AxiosResponse);
    setAuthSession({ ...session, member: { ...member, isKYC: 1 } });
    await harness.navigateByUrl('/mt5-wallet', PortalLayout);
    await harness.fixture.whenStable();

    const element = harness.routeNativeElement!;
    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element.querySelector('app-mt5-wallet')).toBeNull();
    expect(element.querySelector('#wallet-kyc-dialog[open]')).not.toBeNull();
    expect(profileGetMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('opens the KYC popup from the wallet menu, can close it, and confirms via User verify', async () => {
    profileGetMock.mockResolvedValue({
      data: { result: true, data: { id: member.id, isKYC: 0 } },
    } as AxiosResponse);
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
    } as AxiosResponse);
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
    } as AxiosResponse);
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
        }) as AxiosResponse,
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
    } as AxiosResponse);
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
      wallet_status: 1,
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

  it('filters wallets by status and type and makes inactive wallets read-only in both views', async () => {
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
          wallet(1, 'Live Alpha', 'trading', ' LIVE '),
          wallet(2, 'Funded Beta', 'trading', 'funded'),
          wallet(3, 'Main Gamma', 'main', 'wallet'),
          wallet(4, 'Closed Delta', 'trading', 'live', 0),
          wallet(5, 'Archived Wallet', 'main', 'inactive', 0),
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
    } as AxiosResponse);

    const link = element.querySelector<HTMLAnchorElement>('a[aria-label="MT5 & Wallet"]');
    expect(link).not.toBeNull();
    link!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/mt5-wallet');
    expect(link!.getAttribute('aria-current')).toBe('page');
    expect(element.querySelector('.navbar-title')?.textContent).toContain('MT5 & Wallet');
    const walletPage = element.querySelector('app-mt5-wallet')!;
    expect(walletPage.textContent).toContain('250.50 USD');
    expect(element.querySelector('.balance-summary strong')?.textContent?.trim()).toBe('$3,000');
    const tabButtons = walletPage.querySelectorAll('[aria-label="Account type"] button');
    expect([...tabButtons].map((button) => button.textContent?.trim())).toEqual([
      'All',
      'Live',
      'Funded',
      'Demo',
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
      [...walletPage.querySelectorAll('article h3')].map((title) => title.textContent?.trim());

    expect(visibleCards()).toEqual(['Live Alpha', 'Funded Beta', 'Funded Echo', 'Demo Account']);
    expect(walletPage.textContent).toContain('$0');
    for (const [label, names] of [
      ['Live', ['Live Alpha']],
      ['Funded', ['Funded Beta', 'Funded Echo']],
      ['Demo', ['Demo Account']],
      ['Inactive', ['Closed Delta', 'Uncategorized']],
    ] as const) {
      await click(label);
      expect(visibleCards()).toEqual(names);
    }
    for (const card of walletPage.querySelectorAll('article')) {
      expect([...card.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
      card.click();
    }
    await harness.fixture.whenStable();
    expect(walletPage.querySelector('app-card-wallet')).toBeNull();
    await click('Table View');
    const table = walletPage.querySelector('table')!;
    expect(table.tBodies[0].rows).toHaveLength(2);
    expect(table.textContent).toContain('0004');
    expect(table.textContent).not.toContain('Live Alpha');
    expect(table.querySelector('tbody button')).toBeNull();
    table.tBodies[0].rows[0].click();
    await harness.fixture.whenStable();
    expect(walletPage.querySelector('app-card-wallet')).toBeNull();
    await click('All');
    expect(table.tBodies[0].rows).toHaveLength(4);
    expect(table.textContent).not.toContain('Live Bonus');
    expect(table.textContent).not.toContain('Demo Bonus');
    expect(table.textContent).not.toContain('Closed Delta');
    expect(table.textContent).not.toContain('Deleted Wallet');
    expect(table.querySelectorAll('tbody button')).toHaveLength(4);
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/trading');
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
      } as AxiosResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet } },
      } as AxiosResponse);
    await open('/mt5-wallet');
    const page = harness.routeNativeElement!.querySelector('app-mt5-wallet')!;
    await vi.waitFor(() => expect(page.querySelector('article')).not.toBeNull());
    page.querySelector<HTMLElement>('article')!.click();
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
        .mockResolvedValueOnce({ data: { result: true, data: [wallet] } } as AxiosResponse)
        .mockResolvedValueOnce({
          data: { result: true, data: { wallet: { ...wallet, wallet_type: type } } },
        } as AxiosResponse);
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
      } as AxiosResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet } },
      } as AxiosResponse);
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
    let finish!: (value: AxiosResponse) => void;
    const remove = vi.spyOn(api, 'delete').mockImplementation(
      () =>
        new Promise<AxiosResponse>((resolve) => {
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
    finish({ status: 200, data: { result: true, data: {} } } as AxiosResponse);
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
        } as AxiosResponse);
      }
      remove.mockResolvedValueOnce({ status: 200, data: { result: true } } as AxiosResponse);
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
      } as AxiosResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { result: true, data: { wallet: { ...selected, member_id: 14966 } } },
      } as AxiosResponse);
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
      expect(dialog?.textContent).toContain('#14966');
    });
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
    ).toEqual(['All', 'Inactive']);
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
    await vi.waitFor(() => expect(page.textContent).toContain('No accounts found.'));
    expect(page.querySelector('article')).toBeNull();
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
    expect(element.querySelector('.balance-summary strong')?.textContent?.trim()).toBe('$3,000');
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
    expect(profileGetMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
    expect(getMock).not.toHaveBeenCalled();
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
