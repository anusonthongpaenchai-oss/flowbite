import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { api, ApiError, type ApiResponse } from '../../../shared/api/api';
import type { ProfileUpdateRequest } from '../../../shared/api/userInfo/profileUpdate';
import type { UserInfoResponse } from '../../../shared/api/userInfo/userInfo';
import { clearAuthSession, getAuthSession, setAuthSession } from '../../../shared/guard/auth';
import { routes } from '../../app.routes';
import { PortalLayout } from '../../components/layouts/portal-layout/portal-layout';
import { Login } from '../login/login';
import { UserInfo } from './user-info';

describe('UserInfo', () => {
  let component: UserInfo;
  let fixture: ComponentFixture<UserInfo>;
  const getMock = vi.fn<typeof api.get>();
  const postMock = vi.fn<typeof api.post>();
  const putMock = vi.fn<typeof api.put>();
  const profile: UserInfoResponse = {
    result: true,
    message: 'Profile retrieved.',
    data: {
      member: {
        id: 1,
        username: 'member',
        email: 'member@example.com',
        m_image_url: '',
        m_name: 'Test',
        m_lastname: 'Member',
        m_phone: '0812345678',
        m_phone_code: '+66',
        m_gender: 'male',
        m_nationality: 'Thai',
        m_country: 'Thailand',
        m_state: 'Bangkok',
        m_identity: '',
        isActive: 1,
        isConfirm: 1,
        isKYC: 0,
        campaign_name: '',
        lastLogin: '2026-11-03T00:00:00Z',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
        ib: 0,
        ibType: 0,
        mt5_category: 0,
        member_roles: [],
      },
      address: {
        id: 1,
        member_id: 1,
        address_no: '123 Main Road',
        address_district: 'Khlong Tan Nuea',
        address_city: 'Watthana',
        address_state: 'Bangkok',
        address_zipcode: '10110',
        address_stat: 1,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
      },
      isTrusted: true,
    },
  };

  const update: ProfileUpdateRequest = {
    member: {
      m_name: 'Updated',
      m_lastname: 'Member',
      m_country: 'United Kingdom',
      m_phone: '+442079460958',
      m_gender: 'FEMALE',
    },
    address: {
      address_no: '456 New Road',
      address_district: 'Suthep',
      address_city: 'Mueang',
      address_state: 'Chiang Mai',
      address_zipcode: '50200',
    },
  };

  function updatedProfile(): UserInfoResponse {
    return {
      ...profile,
      data: {
        ...profile.data,
        member: { ...profile.data.member, ...update.member },
        address: { ...profile.data.address!, ...update.address },
      },
    };
  }

  function response(data: UserInfoResponse): ApiResponse<UserInfoResponse> {
    return { data, status: 200 } as ApiResponse<UserInfoResponse>;
  }

  beforeEach(async () => {
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
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => 'blob:profile-preview') },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    getMock.mockReset();
    getMock.mockResolvedValue(response(profile));
    vi.spyOn(api, 'get').mockImplementation(getMock);
    postMock.mockReset();
    postMock.mockResolvedValue({
      data: { result: true, message: 'Logged out.' },
      status: 200,
    } as ApiResponse);
    vi.spyOn(api, 'post').mockImplementation(postMock);
    putMock.mockReset();
    putMock.mockResolvedValue({
      status: 200,
      data: { result: true, message: 'Profile updated.' },
    } as ApiResponse);
    vi.spyOn(api, 'put').mockImplementation(putMock);
    clearAuthSession();
    setAuthSession({
      require2FA: false,
      twoFaEnabled: true,
      rememberDevice: true,
      member: { ...profile.data.member, m_image_path: '' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });

    await TestBed.configureTestingModule({
      imports: [UserInfo],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(UserInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('loads the profile on entry and displays it through the existing signals', async () => {
    const element = render();
    await fixture.whenStable();

    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
    expect(component.firstName()).toBe('Test');
    expect(component.lastName()).toBe('Member');
    expect(component.gender()).toBe('male');
    expect(component.country()).toBe('Thailand');
    expect(component.email()).toBe('member@example.com');
    expect(component.phone()).toBe('0812345678');
    expect(component.address()).toBe('123 Main Road');
    expect(component.subDistrict()).toBe('Khlong Tan Nuea');
    expect(component.district()).toBe('Watthana');
    expect(component.province()).toBe('Bangkok');
    expect(component.zipCode()).toBe('10110');
    expect(component.googleLink()).toBe(false);
    expect(component.facebookLink()).toBe(true);
    expect(component.appleLink()).toBe(false);
    expect(element.querySelector('.profile-name')?.textContent?.trim()).toBe('Test Member');
    expect(element.querySelector('.profile-uid')?.textContent).toBe('#UID 1');
    expect(element.querySelector('[aria-labelledby="general-title"]')?.textContent).toContain(
      'Test',
    );
    expect(element.querySelector('[aria-labelledby="contact-title"]')?.textContent).toContain(
      'member@example.com',
    );
    const addressSection = element.querySelector('[aria-labelledby="address-title"]');
    expect(
      Array.from(addressSection?.querySelectorAll('.info-row') ?? [], (row) => [
        row.querySelector('dt')?.textContent?.trim(),
        row.querySelector('dd')?.textContent?.trim(),
      ]),
    ).toEqual([
      ['Address', '123 Main Road'],
      ['Sub-district', 'Khlong Tan Nuea'],
      ['District/City', 'Watthana'],
      ['Province/State', 'Bangkok'],
      ['ZIP/Postal code', '10110'],
    ]);
    expect(addressSection?.nextElementSibling?.getAttribute('aria-labelledby')).toBe(
      'social-title',
    );
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows loading until the profile request completes', async () => {
    let resolveRequest!: (value: UserInfoResponse) => void;
    getMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = (profile) => resolve(response(profile));
      }),
    );
    const element = render();

    expect(component.isLoading()).toBe(true);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading profile');

    resolveRequest(profile);
    await fixture.whenStable();

    expect(component.isLoading()).toBe(false);
    expect(component.firstName()).toBe('Test');
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('still displays the member when no address has been saved', async () => {
    getMock.mockResolvedValueOnce(
      response({
        ...profile,
        data: { ...profile.data, address: null },
      }),
    );

    const element = render();
    await fixture.whenStable();

    expect(component.firstName()).toBe('Test');
    expect(component.address()).toBe('');
    expect(component.subDistrict()).toBe('');
    expect(component.district()).toBe('');
    expect(component.province()).toBe('');
    expect(component.zipCode()).toBe('');
    expect(component.errorMessage()).toBe('');
    expect(
      Array.from(element.querySelectorAll('[aria-labelledby="address-title"] dd'), (value) =>
        value.textContent?.trim(),
      ),
    ).toEqual(['—', '—', '—', '—', '—']);
  });

  it('shows the backend error without filling the signals when the request is rejected', async () => {
    getMock.mockResolvedValueOnce(
      response({
        ...profile,
        result: false,
        message: 'Profile is unavailable.',
      }),
    );

    const element = render();
    await fixture.whenStable();

    expect(component.isLoading()).toBe(false);
    expect(component.firstName()).toBe('');
    expect(component.email()).toBe('');
    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Profile is unavailable.');
  });

  it('shows a request error and clears the loading state', async () => {
    getMock.mockRejectedValueOnce(new Error('Unable to connect.'));

    const element = render();
    await fixture.whenStable();

    expect(component.isLoading()).toBe(false);
    expect(component.firstName()).toBe('');
    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Unable to connect.');
  });

  it('uses normal logout when the server no longer trusts a previously remembered device', async () => {
    getMock.mockResolvedValueOnce(
      response({ ...profile, data: { ...profile.data, isTrusted: false } }),
    );
    const element = render();
    await fixture.whenStable();

    expect(getAuthSession()).toMatchObject({ twoFaEnabled: true, rememberDevice: false });
    element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.click();
    await fixture.whenStable();
    const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
    expect(dialog.querySelector('input[type="checkbox"]')).toBeNull();
    findButton(dialog, 'Logout').click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/auth/logout',
      { forgetDevice: false },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it('restores device removal in an open popup when a trusted profile finishes loading', async () => {
    let resolveProfile!: (value: ApiResponse<UserInfoResponse>) => void;
    getMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    setAuthSession({ ...getAuthSession()!, twoFaEnabled: undefined, rememberDevice: false });
    const element = render();
    component.logoutFlow.open();
    fixture.detectChanges();
    const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
    expect(dialog.querySelector('input[type="checkbox"]')).toBeNull();

    resolveProfile(response(profile));
    await fixture.whenStable();

    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(getAuthSession()).toMatchObject({ twoFaEnabled: true, rememberDevice: true });
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each([
    { twoFaEnabled: false, rememberDevice: false },
    { twoFaEnabled: false, rememberDevice: true },
    { twoFaEnabled: undefined, rememberDevice: true },
    { twoFaEnabled: true, rememberDevice: false },
    { twoFaEnabled: true, rememberDevice: undefined },
  ])(
    'hides remembered devices and allows cancelling with 2FA=$twoFaEnabled, rememberDevice=$rememberDevice',
    async ({ twoFaEnabled, rememberDevice }) => {
      setAuthSession({ ...getAuthSession()!, twoFaEnabled, rememberDevice });
      getMock.mockResolvedValueOnce(
        response({ ...profile, data: { ...profile.data, isTrusted: false } }),
      );
      const element = render();
      await fixture.whenStable();

      element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.click();
      await fixture.whenStable();
      const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;

      expect(dialog.open).toBe(true);
      expect(dialog.querySelector('app-checkbox')).toBeNull();
      expect(dialog.textContent).not.toContain('Remove remembered devices');
      expect(dialog.textContent).toContain('Are you sure you want to logout?');
      expect(findButton(dialog, 'Logout')).toBeTruthy();
      expect(findButton(dialog, 'Cancel')).toBeTruthy();
      expect(postMock).not.toHaveBeenCalled();

      findButton(dialog, 'Cancel').click();
      await fixture.whenStable();

      expect(element.querySelector('app-logout-confirmation')).toBeNull();
      expect(getAuthSession()).not.toBeNull();
      expect(postMock).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'confirms logout with remove remembered devices set to %s, clears the session, and opens Login',
    async (removeRememberedDevices) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/user-info', PortalLayout);
      await harness.fixture.whenStable();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl');
      const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
        'app-user-info button[aria-label="Logout"]',
      )!;

      expect(button.querySelector('img')?.getAttribute('src')).toBe('svg/icon/logout-2.svg');
      button.click();
      await harness.fixture.whenStable();

      const dialog = harness.routeNativeElement!.querySelector<HTMLDialogElement>(
        'app-logout-confirmation dialog',
      )!;
      const checkbox = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(dialog.open).toBe(true);
      expect(dialog.textContent).toContain('Are you sure you want to logout?');
      expect(dialog.textContent).toContain('Remove remembered devices (trust for 30 days)');
      expect(checkbox.checked).toBe(false);
      expect(postMock).not.toHaveBeenCalled();
      expect(getAuthSession()).not.toBeNull();

      if (removeRememberedDevices) {
        checkbox.click();
        await harness.fixture.whenStable();
      }
      findButton(dialog, 'Logout').click();
      await harness.fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(
        removeRememberedDevices ? '/v1/auth/sessions/logout' : '/v1/auth/logout',
        removeRememberedDevices ? {} : { forgetDevice: false },
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      expect(getAuthSession()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
      expect(router.url).toBe('/');
      expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
    },
  );

  it.each([
    { twoFaEnabled: false, rememberDevice: false },
    { twoFaEnabled: false, rememberDevice: true },
    { twoFaEnabled: undefined, rememberDevice: true },
    { twoFaEnabled: true, rememberDevice: false },
    { twoFaEnabled: true, rememberDevice: undefined },
  ])(
    'uses normal logout without a checkbox with 2FA=$twoFaEnabled, rememberDevice=$rememberDevice',
    async ({ twoFaEnabled, rememberDevice }) => {
      setAuthSession({ ...getAuthSession()!, twoFaEnabled, rememberDevice });
      getMock.mockResolvedValueOnce(
        response({ ...profile, data: { ...profile.data, isTrusted: false } }),
      );
      const element = render();
      await fixture.whenStable();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

      element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.click();
      await fixture.whenStable();
      const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
      expect(dialog.querySelector('input[type="checkbox"]')).toBeNull();

      findButton(dialog, 'Logout').click();
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(
        '/v1/auth/logout',
        { forgetDevice: false },
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      expect(getAuthSession()).toBeNull();
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(sessionStorage.getItem('authSession')).toBeNull();
      expect(component.logoutFlow.isOpen()).toBe(false);
      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    },
  );

  it.each(['Cancel', 'Escape'])(
    'cancels logout using %s and resets the checkbox when reopened',
    async (action) => {
      const element = render();
      await fixture.whenStable();
      const button = element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!;
      button.click();
      await fixture.whenStable();
      const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
      dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
      await fixture.whenStable();

      if (action === 'Cancel') {
        findButton(dialog, 'Cancel').click();
      } else {
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      }
      await fixture.whenStable();

      expect(element.querySelector('app-logout-confirmation')).toBeNull();
      expect(postMock).not.toHaveBeenCalled();
      expect(getAuthSession()).not.toBeNull();

      button.click();
      await fixture.whenStable();
      expect(
        element.querySelector<HTMLInputElement>('app-logout-confirmation input')!.checked,
      ).toBe(false);
    },
  );

  it('requires an open confirmation before sending a logout request', async () => {
    render();
    await fixture.whenStable();

    await component.logoutFlow.confirm(false);
    await component.logoutFlow.confirm(true);

    expect(postMock).not.toHaveBeenCalled();
    expect(getAuthSession()).not.toBeNull();
  });

  it.each([false, true])(
    'disables controls and prevents duplicate logout requests (%s)',
    async (removeRememberedDevices) => {
      let resolveRequest!: (value: ApiResponse) => void;
      postMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      );
      const element = render();
      await fixture.whenStable();

      component.logoutFlow.open();
      fixture.detectChanges();
      const request = component.logoutFlow.confirm(removeRememberedDevices);
      fixture.detectChanges();
      const button = element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!;

      expect(component.logoutFlow.isLoggingOut()).toBe(true);
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Logging out...');
      const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
      expect(
        Array.from(
          dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'),
        ).every((control) => control.disabled),
      ).toBe(true);
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      component.logoutFlow.close();
      expect(dialog.open).toBe(true);
      expect(component.logoutFlow.isOpen()).toBe(true);
      button.click();
      await component.logoutFlow.confirm(removeRememberedDevices);
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(getAuthSession()).not.toBeNull();

      resolveRequest({
        data: { result: true, message: 'Logged out.' },
        status: 200,
      } as ApiResponse);
      await request;

      expect(component.logoutFlow.isLoggingOut()).toBe(false);
      expect(getAuthSession()).toBeNull();
    },
  );

  it.each([
    { removeRememberedDevices: false, failure: 'backend' },
    { removeRememberedDevices: false, failure: 'network' },
    { removeRememberedDevices: true, failure: 'backend' },
    { removeRememberedDevices: true, failure: 'network' },
    { removeRememberedDevices: true, failure: 'http' },
    { removeRememberedDevices: true, failure: 'malformed' },
    { removeRememberedDevices: true, failure: 'invalid-json' },
    { removeRememberedDevices: false, failure: 'backend', rememberDevice: false },
    { removeRememberedDevices: false, failure: 'network', rememberDevice: false },
  ])(
    'keeps the session and allows retrying after a $failure logout error (remove devices: $removeRememberedDevices)',
    async ({ removeRememberedDevices, failure, rememberDevice = true }) => {
      setAuthSession({ ...getAuthSession()!, rememberDevice });
      getMock.mockResolvedValueOnce(
        response({ ...profile, data: { ...profile.data, isTrusted: rememberDevice } }),
      );
      if (failure === 'backend') {
        postMock.mockResolvedValueOnce({
          data: { result: false, message: 'Logout rejected.' },
          status: 200,
        } as ApiResponse);
      } else if (failure === 'http') {
        postMock.mockResolvedValueOnce({
          data: { result: true, error: { message: 'Logout rejected.' } },
          status: 500,
        } as ApiResponse);
      } else if (failure === 'malformed') {
        postMock.mockResolvedValueOnce({ data: null, status: 200 } as ApiResponse);
      } else if (failure === 'invalid-json') {
        postMock.mockRejectedValueOnce(new ApiError('Invalid JSON', undefined, true));
      } else {
        postMock.mockRejectedValueOnce(new Error('Network Error'));
      }
      const element = render();
      await fixture.whenStable();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

      component.logoutFlow.open();
      fixture.detectChanges();
      const dialog = element.querySelector<HTMLDialogElement>('app-logout-confirmation dialog')!;
      if (removeRememberedDevices) {
        dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
        fixture.detectChanges();
      }
      findButton(dialog, 'Logout').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(dialog.querySelector('[role="alert"]')?.textContent).toMatch(
        /rejected|connect|sign out|invalid/,
      );
      expect(dialog.open).toBe(true);
      if (rememberDevice) {
        expect(dialog.querySelector<HTMLInputElement>('input')!.checked).toBe(
          removeRememberedDevices,
        );
      } else {
        expect(dialog.querySelector('input[type="checkbox"]')).toBeNull();
      }
      expect(
        element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.disabled,
      ).toBe(false);
      expect(component.logoutFlow.isLoggingOut()).toBe(false);
      expect(getAuthSession()).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();

      findButton(dialog, 'Logout').click();
      await fixture.whenStable();

      expect(component.logoutFlow.errorMessage()).toBe('');
      expect(component.logoutFlow.isOpen()).toBe(false);
      expect(getAuthSession()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    },
  );

  it.each([
    ['Change image profile', 'isChangeImageProfile'],
    ['Change Password', 'isChangePassword'],
    ['Edit Profile', 'isEditProfile'],
  ] as const)('sets the %s signal to true when clicked', async (label, state) => {
    const element = render();
    await fixture.whenStable();
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === label,
    )!;

    expect(component.isChangeImageProfile()).toBe(false);
    expect(component.isChangePassword()).toBe(false);
    expect(component.isEditProfile()).toBe(false);

    button.click();

    expect(component[state]()).toBe(true);
    expect(
      [
        component.isChangeImageProfile(),
        component.isChangePassword(),
        component.isEditProfile(),
      ].filter(Boolean),
    ).toHaveLength(1);
  });

  it.each([
    [{ isKyc: 0, isKYC: 1 }, false],
    [{ isKyc: 1, isKYC: 0 }, true],
    [{ isKYC: 1 }, true],
    [{ isKYC: undefined }, true],
  ] as const)('sets Edit Profile availability for KYC flags %j', async (flags, disabled) => {
    getMock.mockResolvedValueOnce({
      status: 200,
      data: {
        ...profile,
        data: { ...profile.data, member: { ...profile.data.member, ...flags } },
      },
    } as ApiResponse);

    const element = render();
    await fixture.whenStable();
    const editButton = findButton(element, 'Edit Profile');

    expect(editButton.disabled).toBe(disabled);
    editButton.click();
    await fixture.whenStable();
    expect(element.querySelector('app-edit-profile') === null).toBe(disabled);
  });

  it('cancels the password form and starts a new flow when reopened', async () => {
    const element = render();
    await fixture.whenStable();
    expect(element.querySelector('app-chang-password')).toBeNull();
    findButton(element, 'Change Password').click();
    await fixture.whenStable();
    fillFields(element, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    postMock.mockResolvedValueOnce({
      status: 200,
      data: {
        message: 'OTP sent.',
        data: { memberRef: 'cancelled-reference', expiresAt: new Date() },
      },
    } as ApiResponse);
    await fixture.whenStable();
    findButton(element, 'Next').click();
    await fixture.whenStable();
    fillFields(element, { otpCode: '001234' });

    findButton(element, 'Back').click();
    await fixture.whenStable();
    expect(element.querySelector('.otp-digit')).toBeNull();
    findButton(element, 'Back').click();
    await fixture.whenStable();

    expect(component.isChangePassword()).toBe(false);
    expect(element.querySelector('app-chang-password')).toBeNull();
    expect(putMock).not.toHaveBeenCalled();
    expect(getAuthSession()).not.toBeNull();

    findButton(element, 'Change Password').click();
    await fixture.whenStable();

    expect(
      element.querySelector<HTMLInputElement>('[formControlName="currentPassword"] input')!.value,
    ).toBe('');
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="newPassword"] input')!.value,
    ).toBe('');
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="confirmPassword"] input')!.value,
    ).toBe('');
    expect(
      element.querySelector<HTMLSelectElement>('select[formControlName="otpMethod"]')!.value,
    ).toBe('sms');
    expect(element.querySelector('[formControlName="otpCode"]')).toBeNull();
    expect(findButton(element, 'Next').disabled).toBe(true);
    expect(postMock).toHaveBeenCalledOnce();
  });

  it.each(['sms', 'email'] as const)(
    'clears both session stores and opens Login after changing the password with %s OTP',
    async (method) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/user-info', PortalLayout);
      await harness.fixture.whenStable();
      localStorage.setItem('authSession', sessionStorage.getItem('authSession')!);
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl');
      const element = harness.routeNativeElement!;
      findButton(element, 'Change Password').click();
      await harness.fixture.whenStable();
      fillFields(element, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });
      const select = element.querySelector<HTMLSelectElement>(
        'select[formControlName="otpMethod"]',
      )!;
      select.value = method;
      select.dispatchEvent(new Event('change'));
      postMock.mockResolvedValueOnce({
        status: 200,
        data: { data: { memberRef: `${method}-reference`, expiresAt: new Date() } },
      } as ApiResponse);
      await harness.fixture.whenStable();

      findButton(element, 'Next').click();
      await harness.fixture.whenStable();
      fillFields(element, { otpCode: '001234' });
      findButton(element, 'Verify').click();
      await harness.fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(`/v1/verify/${method}/send`);
      expect(putMock).toHaveBeenCalledExactlyOnceWith('/v1/member/change-password', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
        otpMethod: method,
        memberRef: `${method}-reference`,
        otpCode: '001234',
        token: '',
      });
      expect(sessionStorage.getItem('authSession')).toBeNull();
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
      expect(router.url).toBe('/');
      expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
    },
  );

  it.each(['button', 'icon'])(
    'returns from address to member without closing Edit Profile when clicking the Back %s',
    async (target) => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/user-info', PortalLayout);
      const userInfo = harness.routeDebugElement!.query(By.directive(UserInfo))
        .componentInstance as UserInfo;
      await harness.fixture.whenStable();
      const element = harness.routeNativeElement!;
      const findButton = (label: string) =>
        [...element.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === label,
        )!;

      findButton('Edit Profile').click();
      await harness.fixture.whenStable();

      const member = {
        m_name: 'Test',
        m_lastname: 'Member',
        m_country: 'Thailand',
        m_phone: '0812345678',
      };
      for (const [name, value] of Object.entries(member)) {
        fillFields(element, { [name]: value });
      }

      findButton('Next').click();
      await harness.fixture.whenStable();
      expect(element.querySelector('[formControlName="address_no"]')).not.toBeNull();

      const back = findButton('Back');
      if (target === 'icon') {
        back.querySelector('img')!.click();
      } else {
        back.click();
      }
      await harness.fixture.whenStable();

      expect(userInfo.isEditProfile()).toBe(true);
      expect(TestBed.inject(Router).url).toBe('/user-info');
      expect(element.querySelector('[role="dialog"]')).not.toBeNull();
      expect(element.querySelector('[formControlName="address_no"]')).toBeNull();
      expect(
        element.querySelector<HTMLInputElement>('app-input[formControlName="m_name"] input')!.value,
      ).toBe('Test');
      expect(findButton('Next')).toBeDefined();
    },
  );

  it.each(['Back', 'backdrop'])(
    'closes Edit Profile from %s and clears its signal',
    async (action) => {
      const element = render();
      await fixture.whenStable();
      const editButton = [...element.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Edit Profile',
      )!;
      editButton.click();
      await fixture.whenStable();

      expect(component.isEditProfile()).toBe(true);
      expect(element.querySelector('[role="dialog"]')).not.toBeNull();

      const modal = element.querySelector<HTMLElement>('app-edit-profile')!;
      if (action === 'Back') {
        modal.querySelector('button')!.click();
      } else {
        modal.querySelector<HTMLElement>('div')!.click();
      }
      await fixture.whenStable();

      expect(component.isEditProfile()).toBe(false);
      expect(element.querySelector('app-edit-profile')).toBeNull();
    },
  );

  async function openEditor(): Promise<HTMLElement> {
    const element = render();
    await fixture.whenStable();
    component.openEditProfile();
    await fixture.whenStable();
    return element;
  }

  it('uploads a chosen profile image, closes the preview, and refreshes the displayed avatar', async () => {
    const element = render();
    await fixture.whenStable();
    expect(element.querySelector('app-chang-image')).toBeNull();

    findButton(element, 'Change image profile').click();
    await fixture.whenStable();

    const modal = element.querySelector('app-chang-image')!;
    expect(modal.querySelector('dialog')!.open).toBe(true);
    const file = new File(['profile image'], 'profile.png', { type: 'image/png' });
    const input = modal.querySelector('input')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const newImageUrl = 'https://example.com/profile.png';
    postMock.mockResolvedValueOnce({ status: 200, data: { result: true } } as ApiResponse);
    getMock.mockResolvedValueOnce(
      response({
        ...profile,
        data: { ...profile.data, member: { ...profile.data.member, m_image_url: newImageUrl } },
      }),
    );

    findButton(modal as HTMLElement, 'Save').click();
    await fixture.whenStable();

    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe('/v1/member/profile/image');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('profileImage')).toBe(file);
    expect(config?.validateStatus).toEqual(expect.any(Function));
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(element.querySelector('app-chang-image')).toBeNull();
    expect(element.querySelector('img.profile-avatar')!.getAttribute('src')).toBe(newImageUrl);
    expect(component.updateSuccessMessage()).toContain('Profile image updated');
  });

  it('closes the image preview without uploading when the close button is clicked', async () => {
    const element = render();
    await fixture.whenStable();
    findButton(element, 'Change image profile').click();
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('app-chang-image .close-button button')!.click();
    await fixture.whenStable();

    expect(component.isChangeImageProfile()).toBe(false);
    expect(element.querySelector('app-chang-image')).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  function findButton(element: HTMLElement, label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === label,
    )!;
  }

  function fillFields(element: HTMLElement, fields: Record<string, string>): void {
    for (const [name, value] of Object.entries(fields)) {
      const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(
        name === 'otpCode'
          ? '.otp-digit'
          : `select[formControlName="${name}"], input[formControlName="${name}"], app-input[formControlName="${name}"] input`,
      )!;
      input.value = value;
      input.dispatchEvent(
        new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
      );
    }
  }

  function fillMemberUpdate(element: HTMLElement): void {
    fillFields(element, { ...update.member, m_phone: '02079460958', phoneCode: '+44' });
  }

  it('prefills the editor with the loaded member, address, email, and phone code', async () => {
    const element = await openEditor();
    expect(element.querySelector<HTMLInputElement>('[formControlName="m_name"] input')!.value).toBe(
      'Test',
    );
    expect(
      element.querySelector<HTMLSelectElement>('select[formControlName="m_gender"]')!.value,
    ).toBe('MALE');
    const email = element.querySelector<HTMLInputElement>('input[type="email"]')!;
    expect(email.value).toBe('member@example.com');
    expect(email.readOnly).toBe(true);
    expect(element.querySelector('[role="dialog"]')!.textContent).toContain('+66');

    findButton(element, 'Next').click();
    await fixture.whenStable();

    expect(
      element.querySelector<HTMLInputElement>('[formControlName="address_no"] input')!.value,
    ).toBe('123 Main Road');
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="address_state"] input')!.value,
    ).toBe('Bangkok');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('saves from the form through onUpdate and refreshes the displayed profile', async () => {
    const element = await openEditor();
    fillMemberUpdate(element);
    findButton(element, 'Next').click();
    await fixture.whenStable();
    fillFields(element, update.address);
    getMock.mockResolvedValueOnce(response(updatedProfile()));

    findButton(element, 'Save').click();
    await fixture.whenStable();

    expect(putMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/member/profile/update',
      update,
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(component.isUpdating()).toBe(false);
    expect(component.isEditProfile()).toBe(false);
    expect(component.firstName()).toBe('Updated');
    expect(component.formattedPhone()).toBe('+442079460958');
    expect(component.address()).toBe('456 New Road');
    expect(component.province()).toBe('Chiang Mai');
    expect(component.updateErrorMessage()).toBe('');
    expect(element.querySelector('app-edit-profile')).toBeNull();
    expect(element.querySelector('.profile-name')!.textContent).toContain('Updated Member');
    expect(element.querySelector('[role="status"]')!.textContent).toContain('Profile updated.');
  });

  it('prevents duplicate updates and closing while the update request is pending', async () => {
    const element = await openEditor();
    findButton(element, 'Next').click();
    await fixture.whenStable();
    let resolveRequest!: (value: ApiResponse) => void;
    putMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    getMock.mockResolvedValueOnce(response(updatedProfile()));

    findButton(element, 'Save').click();
    fixture.detectChanges();
    await component.onUpdate(update);
    component.closeEditProfile();
    element.querySelector<HTMLElement>('app-edit-profile > div')!.click();

    expect(component.isUpdating()).toBe(true);
    expect(component.isEditProfile()).toBe(true);
    expect(findButton(element, 'Saving…').disabled).toBe(true);
    expect(findButton(element, 'Back').disabled).toBe(true);
    expect(element.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);

    resolveRequest({
      status: 200,
      data: { result: true, message: 'Profile updated.' },
    } as ApiResponse);
    await fixture.whenStable();

    expect(component.isUpdating()).toBe(false);
    expect(component.isEditProfile()).toBe(false);
  });

  it.each(['backend', 'network'])(
    'keeps edits after a %s failure and permits retrying',
    async (failure) => {
      const element = await openEditor();
      fillMemberUpdate(element);
      findButton(element, 'Next').click();
      await fixture.whenStable();
      fillFields(element, update.address);
      if (failure === 'backend') {
        putMock.mockResolvedValueOnce({
          status: 422,
          data: {
            result: false,
            error: { message: 'Phone is already in use.' },
          },
        } as ApiResponse);
      } else {
        putMock.mockRejectedValueOnce(new ApiError('Network Error'));
      }

      findButton(element, 'Save').click();
      await fixture.whenStable();

      expect(component.isEditProfile()).toBe(true);
      expect(component.isUpdating()).toBe(false);
      expect(component.firstName()).toBe('Test');
      expect(component.updateSuccessMessage()).toBe('');
      expect(
        element.querySelector<HTMLInputElement>('[formControlName="address_no"] input')!.value,
      ).toBe('456 New Road');
      expect(element.querySelector('[role="dialog"]')!.textContent).toMatch(
        /already in use|Unable to connect/,
      );

      getMock.mockResolvedValueOnce(response(updatedProfile()));
      findButton(element, 'Save').click();
      await fixture.whenStable();

      expect(putMock).toHaveBeenCalledTimes(2);
      expect(component.isEditProfile()).toBe(false);
      expect(component.updateErrorMessage()).toBe('');
    },
  );

  it('keeps the saved changes if reloading the profile fails after a successful update', async () => {
    await openEditor();
    getMock.mockRejectedValueOnce(new Error('Unable to reload the profile.'));

    await component.onUpdate(update);
    await fixture.whenStable();

    expect(component.firstName()).toBe('Updated');
    expect(component.province()).toBe('Chiang Mai');
    expect(component.updateSuccessMessage()).toBe('Profile updated.');
    expect(component.updateErrorMessage()).toBe('');
    expect(component.errorMessage()).toBe('Unable to reload the profile.');
    expect(component.isEditProfile()).toBe(false);
  });
});
