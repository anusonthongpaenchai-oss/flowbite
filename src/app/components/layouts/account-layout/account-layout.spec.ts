import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AxiosResponse } from 'axios';
import { filter, firstValueFrom } from 'rxjs';
import { api } from '../../../../shared/api/api';
import { clearAuthSession, setAuthSession } from '../../../../shared/guard/auth';
import { routes } from '../../../app.routes';
import { Login } from '../../../page/login/login';
import { PortalLayout } from '../portal-layout/portal-layout';

describe('AccountLayout', () => {
  let harness: RouterTestingHarness;
  const getMock = vi.fn<typeof api.get>();
  const tabs = [
    { label: 'User information', url: '/user-info' },
    { label: 'Bank Account', url: '/user-info/bank-account' },
    { label: 'Crypto Wallet', url: '/user-info/crypto-wallet' },
    { label: 'User verify', url: '/user/verify' },
  ];
  const member = {
    id: 1,
    username: 'member',
    email: 'member@example.com',
    m_image_url: '',
    m_image_path: '',
    m_name: 'Test',
    m_lastname: 'Member',
    isKYC: 0,
    ib: 0,
    ibType: 0,
    mt5_category: 0,
    member_roles: [],
  };

  beforeEach(async () => {
    clearAuthSession();
    setAuthSession({
      require2FA: false,
      member,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });
    getMock.mockReset().mockImplementation(
      async (url) =>
        ({
          status: 200,
          data:
            url === '/v1/verify/kyc'
              ? { result: true, message: 'KYC retrieved.', data: { kyc_stat: 1 } }
              : { result: true, message: 'Profile retrieved.', data: { member, address: null } },
        }) as AxiosResponse,
    );
    vi.spyOn(api, 'get').mockImplementation(getMock);

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideLocationMocks()],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  async function open(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url, PortalLayout);
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  function tabLink(element: HTMLElement, label: string): HTMLAnchorElement {
    return Array.from(element.querySelectorAll<HTMLAnchorElement>('.account-tabs a')).find(
      (link) => link.textContent?.trim() === label,
    )!;
  }

  function expectActiveTab(element: HTMLElement, label: string): void {
    const active = element.querySelectorAll<HTMLAnchorElement>(
      '.account-tabs [aria-current="page"]',
    );
    expect(active).toHaveLength(1);
    expect(active[0].textContent?.trim()).toBe(label);
    expect(active[0].classList.contains('active-tab')).toBe(true);
    expect(element.querySelectorAll('.account-tabs .active-tab')).toHaveLength(1);
  }

  it.each(tabs)(
    'opens $url directly with the correct content and active tab',
    async ({ label, url }) => {
      const element = await open(url);

      expect(TestBed.inject(Router).url).toBe(url);
      expect(element.querySelectorAll('.portal-navbar')).toHaveLength(1);
      expect(element.querySelectorAll('.account-tabs')).toHaveLength(1);
      expect(element.querySelectorAll('h1')).toHaveLength(1);
      expect(
        Array.from(element.querySelectorAll<HTMLAnchorElement>('.account-tabs a')).map((link) =>
          link.getAttribute('href'),
        ),
      ).toEqual(tabs.map((tab) => tab.url));
      expectActiveTab(element, label);

      if (url === '/user-info') {
        expect(element.querySelector('.profile-name')?.textContent?.trim()).toBe('Test Member');
        expect(element.querySelector('app-account-placeholder')).toBeNull();
        expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
      } else if (url === '/user/verify') {
        expect(element.querySelector('app-verify')).not.toBeNull();
        expect(element.querySelector('app-account-placeholder')).toBeNull();
        expect(element.querySelector('app-verify-status')?.textContent).toContain('KYC Approved');
        expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/kyc');
      } else {
        expect(element.querySelector('#account-section-title')?.textContent?.trim()).toBe(label);
        expect(element.querySelector('app-account-placeholder')).not.toBeNull();
        expect(element.querySelector('.profile-card')).toBeNull();
        expect(element.querySelector('.profile-actions')).toBeNull();
        expect(getMock).not.toHaveBeenCalled();
      }
    },
  );

  it('switches profile and placeholder tabs while keeping the same layout, header, and navigation', async () => {
    const element = await open('/user-info');
    const layout = harness.routeDebugElement!.componentInstance;
    const header = element.querySelector('.portal-navbar');
    const navigation = element.querySelector('.account-tabs');

    for (const tab of tabs.slice(1, 3)) {
      tabLink(element, tab.label).click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(tab.url);
      expectActiveTab(element, tab.label);
      expect(element.querySelector('#account-section-title')?.textContent?.trim()).toBe(tab.label);
      expect(harness.routeDebugElement!.componentInstance).toBe(layout);
      expect(element.querySelector('.portal-navbar')).toBe(header);
      expect(element.querySelector('.account-tabs')).toBe(navigation);
      expect(element.querySelectorAll('.portal-navbar')).toHaveLength(1);
      expect(element.querySelectorAll('.account-tabs')).toHaveLength(1);
      expect(getMock).toHaveBeenCalledOnce();
    }

    tabLink(element, 'User information').click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/user-info');
    expectActiveTab(element, 'User information');
    expect(element.querySelector('.profile-name')?.textContent?.trim()).toBe('Test Member');
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(harness.routeDebugElement!.componentInstance).toBe(layout);
  });

  it('opens verification from its tab and returns to the profile with one account layout', async () => {
    const profileElement = await open('/user-info');
    tabLink(profileElement, 'User verify').click();
    await harness.fixture.whenStable();
    const verifyElement = harness.routeNativeElement!;

    expect(TestBed.inject(Router).url).toBe('/user/verify');
    expectActiveTab(verifyElement, 'User verify');
    expect(verifyElement.querySelector('app-verify')).not.toBeNull();
    expect(verifyElement.querySelectorAll('.portal-navbar')).toHaveLength(1);
    expect(verifyElement.querySelectorAll('.account-tabs')).toHaveLength(1);
    expect(getMock).toHaveBeenNthCalledWith(2, '/v1/verify/kyc');

    tabLink(verifyElement, 'User information').click();
    await harness.fixture.whenStable();
    const returnedElement = harness.routeNativeElement!;

    expect(TestBed.inject(Router).url).toBe('/user-info');
    expectActiveTab(returnedElement, 'User information');
    expect(returnedElement.querySelector('.profile-name')?.textContent?.trim()).toBe('Test Member');
    expect(returnedElement.querySelectorAll('.portal-navbar')).toHaveLength(1);
    expect(returnedElement.querySelectorAll('.account-tabs')).toHaveLength(1);
    expect(getMock).toHaveBeenCalledTimes(3);
    expect(getMock).toHaveBeenLastCalledWith('/v1/member/profile');
  });

  it('redirects the legacy verification URL to the canonical route without loading twice', async () => {
    const element = await open('/user-info/user-verify');

    expect(TestBed.inject(Router).url).toBe('/user/verify');
    expect(element.querySelector('app-verify')).not.toBeNull();
    expectActiveTab(element, 'User verify');
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/kyc');
  });

  it('redirects unauthenticated verification visits to login without requesting KYC', async () => {
    clearAuthSession();
    await harness.navigateByUrl('/user/verify', Login);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
    expect(harness.routeNativeElement!.querySelector('app-account-layout')).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('updates the selected tab and placeholder on browser Back and Forward', async () => {
    const element = await open('/user-info/bank-account');
    tabLink(element, 'Crypto Wallet').click();
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    router.setUpLocationChangeListener();

    const back = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.back();
    await back;
    await harness.fixture.whenStable();

    expect(router.url).toBe('/user-info/bank-account');
    expectActiveTab(element, 'Bank Account');
    expect(element.querySelector('#account-section-title')?.textContent?.trim()).toBe(
      'Bank Account',
    );

    const forward = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.forward();
    await forward;
    await harness.fixture.whenStable();

    expect(router.url).toBe('/user-info/crypto-wallet');
    expectActiveTab(element, 'Crypto Wallet');
    expect(element.querySelector('#account-section-title')?.textContent?.trim()).toBe(
      'Crypto Wallet',
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it('keeps the existing Deposit link in the shared header', async () => {
    const element = await open('/user-info/bank-account');
    const deposit = element.querySelector<HTMLAnchorElement>('.portal-navbar a')!;

    expect(deposit.textContent?.trim()).toBe('Deposit');
    expect(deposit.getAttribute('href')).toBe('/hello');
  });
});
