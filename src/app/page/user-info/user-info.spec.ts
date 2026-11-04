import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../../../shared/api/api';
import type { ProfileUpdateRequest } from '../../../shared/api/userInfo/profileUpdate';
import type { UserInfoResponse } from '../../../shared/api/userInfo/userInfo';
import { clearAuthSession, getAuthSession, setAuthSession } from '../../../shared/guard/auth';
import { routes } from '../../app.routes';
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
      isTrusted: false,
    },
  };

  const update: ProfileUpdateRequest = {
    member: {
      m_name: 'Updated',
      m_lastname: 'Member',
      m_country: 'Thailand',
      m_phone: '0899999999',
      m_gender: 'female',
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

  function response(data: UserInfoResponse): AxiosResponse<UserInfoResponse> {
    return { data, status: 200 } as AxiosResponse<UserInfoResponse>;
  }

  beforeEach(async () => {
    getMock.mockReset();
    getMock.mockResolvedValue(response(profile));
    vi.spyOn(api, 'get').mockImplementation(getMock);
    postMock.mockReset();
    postMock.mockResolvedValue({
      data: { result: true, message: 'Logged out.' },
      status: 200,
    } as AxiosResponse);
    vi.spyOn(api, 'post').mockImplementation(postMock);
    putMock.mockReset();
    putMock.mockResolvedValue({
      status: 200,
      data: { result: true, message: 'Profile updated.' },
    } as AxiosResponse);
    vi.spyOn(api, 'put').mockImplementation(putMock);
    clearAuthSession();
    setAuthSession({
      require2FA: false,
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

    render();
    await fixture.whenStable();

    expect(component.firstName()).toBe('Test');
    expect(component.address()).toBe('');
    expect(component.subDistrict()).toBe('');
    expect(component.district()).toBe('');
    expect(component.province()).toBe('');
    expect(component.zipCode()).toBe('');
    expect(component.errorMessage()).toBe('');
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

  it('logs out from the button, clears the session, and opens the login page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/user-info', UserInfo);
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      'button[aria-label="Logout"]',
    )!;

    expect(button.querySelector('img')?.getAttribute('src')).toBe('svg/icon/logout-2.svg');
    button.click();
    await harness.fixture.whenStable();

    expect(postMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/auth/logout',
      { forgetDevice: false },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(getAuthSession()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    expect(router.url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
  });

  it('disables logout and ignores repeated clicks until the request completes', async () => {
    let resolveRequest!: (value: AxiosResponse) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const element = render();
    await fixture.whenStable();

    const request = component.handleLogout();
    fixture.detectChanges();
    const button = element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!;

    expect(component.isLoggingOut()).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Logging out...');
    button.click();
    await component.handleLogout();
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(getAuthSession()).not.toBeNull();

    resolveRequest({
      data: { result: true, message: 'Logged out.' },
      status: 200,
    } as AxiosResponse);
    await request;

    expect(component.isLoggingOut()).toBe(false);
    expect(getAuthSession()).toBeNull();
  });

  it.each(['backend', 'network'])(
    'shows a logout %s error, keeps the session, and allows retrying',
    async (failure) => {
      if (failure === 'backend') {
        postMock.mockResolvedValueOnce({
          data: { result: false, message: 'Logout rejected.' },
          status: 200,
        } as AxiosResponse);
      } else {
        postMock.mockRejectedValueOnce(new Error('Network Error'));
      }
      const element = render();
      await fixture.whenStable();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

      await component.handleLogout();
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent).toMatch(/rejected|connect/);
      expect(
        element.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.disabled,
      ).toBe(false);
      expect(component.isLoggingOut()).toBe(false);
      expect(getAuthSession()).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();

      await component.handleLogout();

      expect(component.logoutErrorMessage()).toBe('');
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

  it.each(['button', 'icon'])(
    'returns from address to member without closing Edit Profile when clicking the Back %s',
    async (target) => {
      const harness = await RouterTestingHarness.create();
      const userInfo = await harness.navigateByUrl('/user-info', UserInfo);
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
        const input = element.querySelector<HTMLInputElement>(
          `app-input[formControlName="${name}"] input`,
        )!;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
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

  function findButton(element: HTMLElement, label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === label,
    )!;
  }

  function fillFields(element: HTMLElement, fields: Record<string, string>): void {
    for (const [name, value] of Object.entries(fields)) {
      const input = element.querySelector<HTMLInputElement>(
        `app-input[formControlName="${name}"] input`,
      )!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  it('prefills the editor with the loaded member, address, email, and phone code', async () => {
    const element = await openEditor();
    expect(element.querySelector<HTMLInputElement>('[formControlName="m_name"] input')!.value).toBe(
      'Test',
    );
    expect(
      element.querySelector<HTMLInputElement>('[formControlName="m_gender"] input')!.value,
    ).toBe('male');
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
    fillFields(element, update.member);
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
    let resolveRequest!: (value: AxiosResponse) => void;
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
    } as AxiosResponse);
    await fixture.whenStable();

    expect(component.isUpdating()).toBe(false);
    expect(component.isEditProfile()).toBe(false);
  });

  it.each(['backend', 'network'])(
    'keeps edits after a %s failure and permits retrying',
    async (failure) => {
      const element = await openEditor();
      fillFields(element, update.member);
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
        } as AxiosResponse);
      } else {
        putMock.mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK));
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

  it('links the Deposit button to /hello', async () => {
    const element = render();
    await fixture.whenStable();

    const deposit = element.querySelector<HTMLAnchorElement>('a[routerLink="/hello"]')!;
    expect(deposit.textContent).toBe('Deposit');
    expect(deposit.getAttribute('href')).toBe('/hello');
  });
});
