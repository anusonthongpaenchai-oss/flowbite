import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AxiosResponse } from 'axios';
import { api } from '../../../shared/api/api';
import { Login } from './login';
import { routes } from '../../app.routes';
import { UserInfo } from '../user-info/user-info';
import { stopTokenRefresh } from '../../../shared/services/tokenRefreshScheduler';
import { getAuthSession } from '../../../shared/guard/auth';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  const postMock = vi.fn<typeof api.post>();
  const sessionData = {
    require2FA: false,
    member: {
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
    },
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600,
    sessionUid: 'test-session',
  };

  function response(data: unknown, status = 200): AxiosResponse {
    return { data, status } as AxiosResponse;
  }

  function successfulResponse(): AxiosResponse {
    return response({
      result: 'success',
      message: 'Login successful.',
      data: sessionData,
      code: 200,
    });
  }

  function challengeResponse(preAuthToken: unknown = 'pre-auth-token'): AxiosResponse {
    return response({
      result: true,
      message: 'Verification required.',
      data: { require2FA: true, preAuthToken },
    });
  }

  const verifiedSession = {
    ...sessionData,
    member: { id: 1, username: 'member', email: 'member@example.com' },
  };

  function verifyResponse(): AxiosResponse {
    return response({ result: true, message: 'Login successful.', data: verifiedSession });
  }

  function dialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector('dialog');
  }

  function enterOtp(value = '012345'): void {
    const input = dialog().querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function otpInputs(): HTMLInputElement[] {
    return Array.from(dialog().querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'));
  }

  async function openChallenge(rememberMe = false): Promise<void> {
    postMock.mockResolvedValueOnce(challengeResponse());
    fillForm(rememberMe);
    await component.handleSubmit();
    await fixture.whenStable();
  }

  function fillForm(rememberMe = false): void {
    component.loginForm.setValue({
      email: 'member@example.com',
      password: 'test-password',
      rememberMe,
    });
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
    postMock.mockReset();
    vi.spyOn(api, 'post').mockImplementation(postMock);
    vi.spyOn(api, 'get').mockResolvedValue(
      response({
        result: true,
        data: { member: sessionData.member, address: null, isTrusted: false },
      }),
    );
    localStorage.removeItem('authSession');
    sessionStorage.removeItem('authSession');

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    stopTokenRefresh();
    localStorage.removeItem('authSession');
    sessionStorage.removeItem('authSession');
    vi.restoreAllMocks();
  });

  it('navigates to signup when the Sign up button is clicked', async () => {
    const router = TestBed.inject(Router);
    const signupButton = fixture.nativeElement.querySelector(
      'app-button[routerLink="/signup"] button',
    ) as HTMLButtonElement;

    signupButton.click();
    await fixture.whenStable();

    expect(router.url).toBe('/signup');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does not navigate when a button without routerLink is clicked', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const button = fixture.nativeElement.querySelector(
      'app-button[variant="secondary"] button',
    ) as HTMLButtonElement;

    button.click();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens forgot password without submitting the sign-in form', async () => {
    const button = fixture.nativeElement.querySelector(
      'app-button[routerLink="/forgot-password"] button',
    ) as HTMLButtonElement;

    button.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/forgot-password');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('marks invalid fields without requesting a login', async () => {
    component.email = 'invalid-email';

    await component.handleSubmit();

    expect(postMock).not.toHaveBeenCalled();
    expect(component.loginForm.get('email')?.touched).toBe(true);
    expect(component.loginForm.get('password')?.touched).toBe(true);
    expect(component.isSubmitting()).toBe(false);
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it.each(['button', 'form'])(
    'submits the input values through the native %s',
    async (submitVia) => {
      postMock.mockResolvedValueOnce(successfulResponse());
      const element = fixture.nativeElement as HTMLElement;
      const emailInput = element.querySelector<HTMLInputElement>('input[type="email"]')!;
      const passwordInput = element.querySelector<HTMLInputElement>('input[type="password"]')!;

      emailInput.value = 'member@example.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.value = 'test-password';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      if (submitVia === 'button') {
        element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      } else {
        element
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(
        '/v1/auth/login',
        {
          usernameOrEmail: 'member@example.com',
          password: 'test-password',
        },
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      expect(component.successMessage()).not.toBe('');
      expect(component.errorMessage()).toBe('');
    },
  );

  it.each([false, true])(
    'stores the authenticated session with Remember me = %s',
    async (rememberMe) => {
      postMock.mockResolvedValueOnce(successfulResponse());
      fillForm(rememberMe);
      const selectedStorage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      otherStorage.setItem('authSession', 'old-session');

      await component.handleSubmit();

      expect(JSON.parse(selectedStorage.getItem('authSession')!)).toEqual({
        ...sessionData,
        tokenExpiresAt: expect.any(Number),
        rememberDevice: false,
      });
      expect(otherStorage.getItem('authSession')).toBeNull();
      expect(selectedStorage.getItem('authSession')).not.toContain('test-password');
      expect(component.password).toBe('');
      expect(component.successMessage()).not.toBe('');
      expect(component.isSubmitting()).toBe(false);
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    },
  );

  it('checks the profile after sign-in and loads the profile when User Account opens', async () => {
    postMock.mockResolvedValueOnce(successfulResponse());
    const getMock = vi.spyOn(api, 'get').mockImplementation(async () => {
      expect(JSON.parse(sessionStorage.getItem('authSession')!)).toEqual({
        ...sessionData,
        tokenExpiresAt: expect.any(Number),
        rememberDevice: false,
      });
      return response({
        result: true,
        message: 'Profile retrieved.',
        data: {
          member: {
            ...sessionData.member,
            m_name: 'Updated Name',
            m_gender: 'male',
            m_country: 'Thailand',
            m_phone: '0812345678',
          },
          address: null,
          isTrusted: false,
        },
      });
    });
    const harness = await RouterTestingHarness.create();
    const loginPage = await harness.navigateByUrl('/', Login);
    loginPage.loginForm.setValue({
      email: 'member@example.com',
      password: 'test-password',
      rememberMe: false,
    });

    await loginPage.handleSubmit();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/member/profile');
    expect(harness.routeNativeElement!.querySelector('app-dashboard')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('.navbar-title')?.textContent?.trim()).toBe(
      'Dashboard',
    );
    harness
      .routeNativeElement!.querySelector<HTMLAnchorElement>('a[aria-label="User Account"]')!
      .click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/user-info');
    expect(getMock.mock.calls.map(([url]) => url)).toEqual([
      '/v1/member/profile',
      '/v1/member/profile',
    ]);
    const profilePage = harness.routeDebugElement!.query(By.directive(UserInfo))
      .componentInstance as UserInfo;
    expect(profilePage).toBeInstanceOf(UserInfo);
    expect(profilePage.firstName()).toBe('Updated Name');
    expect(profilePage.email()).toBe('member@example.com');
    expect(harness.routeNativeElement?.querySelector('.profile-name')?.textContent?.trim()).toBe(
      'Updated Name Member',
    );
  });

  it('disables submission and ignores duplicate requests while login is pending', async () => {
    let resolveRequest!: (value: AxiosResponse) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    fillForm();

    const request = component.handleSubmit();
    fixture.detectChanges();

    expect(component.isSubmitting()).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    await component.handleSubmit();
    expect(postMock).toHaveBeenCalledTimes(1);

    resolveRequest(successfulResponse());
    await request;

    expect(component.isSubmitting()).toBe(false);
  });

  it('shows the backend error and allows another attempt', async () => {
    postMock.mockResolvedValueOnce(response({ message: 'Invalid credentials.', code: 401 }, 401));
    fillForm();

    await component.handleSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Invalid credentials.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid credentials.',
    );
    expect(component.successMessage()).toBe('');
    expect(component.isSubmitting()).toBe(false);
    expect(localStorage.getItem('authSession')).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();

    postMock.mockResolvedValueOnce(successfulResponse());
    await component.handleSubmit();

    expect(component.errorMessage()).toBe('');
    expect(component.successMessage()).not.toBe('');
  });

  it('handles network failures without leaving the form loading', async () => {
    postMock.mockRejectedValueOnce(new Error('Network Error'));
    fillForm();

    await component.handleSubmit();

    expect(component.errorMessage()).toMatch(/connect|network|try again/i);
    expect(component.isSubmitting()).toBe(false);
    expect(component.successMessage()).toBe('');
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it('rejects a two-factor challenge without a preAuthToken', async () => {
    postMock.mockResolvedValueOnce(
      response({
        result: 'success',
        message: 'Verification required.',
        code: 200,
        data: { ...sessionData, require2FA: true },
      }),
    );
    fillForm(true);

    await component.handleSubmit();

    expect(component.errorMessage()).not.toBe('');
    expect(component.successMessage()).toBe('');
    expect(component.isSubmitting()).toBe(false);
    expect(localStorage.getItem('authSession')).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('opens the OTP dialog after login without authenticating or sending the OTP automatically', async () => {
    await openChallenge();

    expect(dialog().open).toBe(true);
    expect(component.errorMessage()).toBe('');
    expect(component.preAuthToken()).toBe('pre-auth-token');
    expect(component.otpForm.getRawValue()).toEqual({ totpToken: '', rememberDevice: false });
    expect(otpInputs()).toHaveLength(6);
    expect(document.activeElement).toBe(otpInputs()[0]);
    expect(otpInputs()[0].autocomplete).toBe('one-time-code');
    expect(dialog().textContent).toContain('Verify your identity');
    expect(dialog().textContent).toContain('Verify & Sign in');
    expect(component.loginForm.disabled).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('authSession')).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');

    enterOtp();
    await component.handleSubmit();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it.each([null, '', '   ', 123])(
    'does not open OTP for an invalid preAuthToken (%s)',
    async (token) => {
      postMock.mockResolvedValueOnce(challengeResponse(token));
      fillForm();
      await component.handleSubmit();

      expect(dialog().open).toBe(false);
      expect(component.preAuthToken()).toBe('');
      expect(component.loginForm.enabled).toBe(true);
      expect(component.errorMessage()).toContain('invalid response');
      expect(sessionStorage.getItem('authSession')).toBeNull();
    },
  );

  it('fills each digit, advances focus, and waits for confirmation before signing in', async () => {
    await openChallenge();
    const inputs = otpInputs();
    for (const [index, digit] of Array.from('001234').entries()) {
      inputs[index].value = digit;
      inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(inputs[Math.min(index + 1, 5)]);
    }
    expect(component.otpForm.controls.totpToken.value).toBe('001234');
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('authSession')).toBeNull();
    postMock.mockResolvedValueOnce(verifyResponse());
    dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(postMock).toHaveBeenLastCalledWith(
      '/v1/auth/2fa/verify',
      {
        preAuthToken: 'pre-auth-token',
        totpToken: '001234',
        rememberDevice: false,
      },
      expect.any(Object),
    );
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('pastes a full code into any digit and preserves empty positions when editing', async () => {
    await openChallenge();
    const inputs = otpInputs();
    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '001234' } });
    inputs[3].dispatchEvent(paste);
    await fixture.whenStable();
    expect(paste.defaultPrevented).toBe(true);
    expect(inputs.map((input) => input.value)).toEqual(['0', '0', '1', '2', '3', '4']);
    expect(component.otpForm.controls.totpToken.value).toBe('001234');
    expect(document.activeElement).toBe(inputs[5]);
    inputs[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(inputs[4]);
    inputs[4].value = '';
    inputs[4].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await fixture.whenStable();
    expect(component.otpDigits()).toEqual(['0', '0', '1', '', '', '4']);
    expect(component.otpForm.invalid).toBe(true);
    expect(document.activeElement).toBe(inputs[3]);
    await component.verifyTwoFa();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('rejects non-numeric characters and focuses the first missing digit after an incomplete submit', async () => {
    await openChallenge();
    enterOtp('a');
    await fixture.whenStable();
    expect(otpInputs()[0].value).toBe('');
    enterOtp('0012');
    await component.verifyTwoFa();
    await fixture.whenStable();
    expect(component.otpError()).toBe('Enter a 6-digit code.');
    expect(document.activeElement).toBe(otpInputs()[4]);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('clears a rejected code message when the user corrects a digit and allows retry', async () => {
    await openChallenge();
    enterOtp();
    postMock.mockResolvedValueOnce(response({ result: false, message: 'Code expired.' }));
    await component.verifyTwoFa();
    await fixture.whenStable();
    expect(component.otpError()).toBe('Code expired.');
    const last = otpInputs()[5];
    last.value = '6';
    last.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(component.otpError()).toBe('');
    expect(component.otpForm.controls.totpToken.value).toBe('012346');
    postMock.mockResolvedValueOnce(verifyResponse());
    dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it.each(['', '12345', '1234567', '12a456', ' 12345', '１２３４５６'])(
    'does not send an invalid OTP (%j)',
    async (otp) => {
      await openChallenge();
      component.otpForm.controls.totpToken.setValue(otp);
      dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('6-digit');
      expect(dialog().open).toBe(true);
    },
  );

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'sends rememberDevice=%s while keeping Remember me=%s independent',
    async (rememberDevice, rememberMe) => {
      await openChallenge(rememberMe);
      enterOtp();
      if (rememberDevice) {
        dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
      }
      // The session storage choice is captured when the initial login starts.
      component.rememberMe = !rememberMe;
      postMock.mockResolvedValueOnce(verifyResponse());

      if (rememberDevice) {
        dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      } else {
        dialog()
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      await fixture.whenStable();

      expect(postMock).toHaveBeenLastCalledWith(
        '/v1/auth/2fa/verify',
        {
          preAuthToken: 'pre-auth-token',
          totpToken: '012345',
          rememberDevice,
        },
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      const selectedStorage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      expect(JSON.parse(selectedStorage.getItem('authSession')!)).toEqual({
        ...verifiedSession,
        tokenExpiresAt: expect.any(Number),
        twoFaEnabled: true,
        rememberDevice,
      });
      expect(otherStorage.getItem('authSession')).toBeNull();
      expect(selectedStorage.getItem('authSession')).not.toContain('pre-auth-token');
      expect(dialog().open).toBe(false);
      expect(component.preAuthToken()).toBe('');
      expect(component.otpForm.getRawValue()).toEqual({ totpToken: '', rememberDevice: false });
      expect(component.password).toBe('');
      expect(TestBed.inject(Router).url).toBe('/dashboard');

      // Recreating the page must restore the device choice from the saved session.
      fixture.destroy();
      vi.spyOn(api, 'get').mockResolvedValueOnce(
        response({
          result: true,
          message: 'Profile retrieved.',
          data: { member: verifiedSession.member, address: null, isTrusted: rememberDevice },
        }),
      );
      const profileFixture = TestBed.createComponent(UserInfo);
      profileFixture.detectChanges();
      await profileFixture.whenStable();
      const profileElement = profileFixture.nativeElement as HTMLElement;
      profileElement.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!.click();
      await profileFixture.whenStable();

      expect(
        profileElement.querySelector('app-logout-confirmation input[type="checkbox"]') !== null,
      ).toBe(rememberDevice);
      profileFixture.destroy();
    },
  );

  it.each([false, true])(
    'keeps offering device removal across trusted logins until revoked (Remember me=%s)',
    async (rememberMe) => {
      let isTrusted = true;
      vi.spyOn(api, 'get').mockImplementation(async () =>
        response({
          result: true,
          message: 'Profile retrieved.',
          data: { member: verifiedSession.member, address: null, isTrusted },
        }),
      );
      const harness = await RouterTestingHarness.create();
      let loginPage = await harness.navigateByUrl('/', Login);
      loginPage.loginForm.setValue({
        email: 'member@example.com',
        password: 'test-password',
        rememberMe,
      });
      postMock.mockResolvedValueOnce(challengeResponse());
      await loginPage.handleSubmit();
      loginPage.otpForm.setValue({ totpToken: '012345', rememberDevice: true });
      postMock.mockResolvedValueOnce(verifyResponse());
      await loginPage.verifyTwoFa();
      await harness.fixture.whenStable();

      for (let cycle = 0; cycle < 3; cycle++) {
        await harness.navigateByUrl('/user-info');
        await harness.fixture.whenStable();
        expect(getAuthSession()).toMatchObject({ twoFaEnabled: true, rememberDevice: true });
        const selectedStorage = rememberMe ? localStorage : sessionStorage;
        const otherStorage = rememberMe ? sessionStorage : localStorage;
        expect(selectedStorage.getItem('authSession')).not.toBeNull();
        expect(otherStorage.getItem('authSession')).toBeNull();
        harness
          .routeNativeElement!.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!
          .click();
        await harness.fixture.whenStable();
        const logoutDialog = harness.routeNativeElement!.querySelector<HTMLDialogElement>(
          'app-logout-confirmation dialog',
        )!;
        const checkbox = logoutDialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(checkbox).not.toBeNull();
        expect(checkbox.checked).toBe(false);
        if (cycle === 2) {
          checkbox.click();
          await harness.fixture.whenStable();
          isTrusted = false;
        }
        postMock.mockResolvedValueOnce(response({ result: true, message: 'Logged out.' }));
        logoutDialog.querySelector<HTMLButtonElement>('app-button button')!.click();
        await harness.fixture.whenStable();

        expect(postMock).toHaveBeenLastCalledWith(
          cycle === 2 ? '/v1/auth/sessions/logout' : '/v1/auth/logout',
          cycle === 2 ? {} : { forgetDevice: false },
          expect.objectContaining({ validateStatus: expect.any(Function) }),
        );
        expect(getAuthSession()).toBeNull();
        expect(TestBed.inject(Router).url).toBe('/');
        loginPage = harness.routeDebugElement!.componentInstance as Login;
        loginPage.loginForm.setValue({
          email: 'member@example.com',
          password: 'test-password',
          rememberMe,
        });
        postMock.mockResolvedValueOnce(cycle === 2 ? challengeResponse() : successfulResponse());
        await loginPage.handleSubmit();
        await harness.fixture.whenStable();
      }

      expect(TestBed.inject(Router).url).toBe('/');
      expect(loginPage.preAuthToken()).toBe('pre-auth-token');
      loginPage.otpForm.setValue({ totpToken: '012345', rememberDevice: false });
      postMock.mockResolvedValueOnce(verifyResponse());
      await loginPage.verifyTwoFa();
      await harness.fixture.whenStable();
      expect(getAuthSession()?.rememberDevice).toBe(false);
      await harness.navigateByUrl('/user-info');
      await harness.fixture.whenStable();
      harness
        .routeNativeElement!.querySelector<HTMLButtonElement>('button[aria-label="Logout"]')!
        .click();
      await harness.fixture.whenStable();
      expect(
        harness.routeNativeElement!.querySelector('app-logout-confirmation input[type="checkbox"]'),
      ).toBeNull();
    },
  );

  it('uses formControlName for the existing Remember me checkbox', async () => {
    fillForm();
    fixture.nativeElement.querySelector('app-checkbox[formControlName="rememberMe"] input').click();
    expect(component.rememberMe).toBe(true);
    postMock.mockResolvedValueOnce(successfulResponse());
    await component.handleSubmit();
    expect(localStorage.getItem('authSession')).not.toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it.each(['http', 'result', 'network', 'malformed'])(
    'keeps OTP available after a %s failure and allows retry',
    async (failure) => {
      await openChallenge();
      enterOtp();
      if (failure === 'network') {
        postMock.mockRejectedValueOnce(new Error('Network Error'));
      } else {
        postMock.mockResolvedValueOnce(
          failure === 'malformed'
            ? response({
                result: true,
                message: 'OK',
                data: { ...verifiedSession, accessToken: '' },
              })
            : response({ result: false, message: 'Invalid code.' }, failure === 'http' ? 401 : 200),
        );
      }
      dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();

      expect(component.otpErrorMessage()).not.toBe('');
      expect(dialog().open).toBe(true);
      expect(component.preAuthToken()).toBe('pre-auth-token');
      expect(component.otpForm.enabled).toBe(true);
      expect(component.isVerifying()).toBe(false);
      expect(component.otpForm.controls.totpToken.value).toBe('012345');
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(sessionStorage.getItem('authSession')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/');

      postMock.mockResolvedValueOnce(verifyResponse());
      dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
      expect(postMock).toHaveBeenCalledTimes(3);
      expect(TestBed.inject(Router).url).toBe('/dashboard');
    },
  );

  it('blocks duplicate verifies, a new login and closing while verification is pending', async () => {
    await openChallenge();
    enterOtp();
    let resolveRequest!: (value: AxiosResponse) => void;
    postMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const pending = component.verifyTwoFa();
    fixture.detectChanges();

    await component.verifyTwoFa();
    await component.handleSubmit();
    const cancel = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(cancel);
    component.cancelTwoFa();
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(2);
    enterOtp('654321');
    otpInputs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(component.otpForm.controls.totpToken.value).toBe('012345');
    expect(
      Array.from(dialog().querySelectorAll('input, button')).every(
        (element) => (element as HTMLInputElement).disabled,
      ),
    ).toBe(true);

    resolveRequest(verifyResponse());
    await pending;
    expect(component.isVerifying()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it.each(['button', 'close', 'escape'])(
    'clears the challenge on %s cancellation and starts a fresh login',
    async (cancelVia) => {
      await openChallenge();
      enterOtp();
      dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
      if (cancelVia === 'button') {
        dialog()
          .querySelector<HTMLButtonElement>('app-button[variant="secondary"] button')!
          .click();
      } else if (cancelVia === 'close') {
        dialog()
          .querySelector<HTMLButtonElement>('[aria-label="Cancel two-factor authentication"]')!
          .click();
      } else {
        dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      }
      await fixture.whenStable();

      expect(dialog().open).toBe(false);
      expect(component.preAuthToken()).toBe('');
      expect(component.loginForm.enabled).toBe(true);
      expect(component.otpForm.getRawValue()).toEqual({ totpToken: '', rememberDevice: false });
      expect(component.otpDigits()).toEqual(['', '', '', '', '', '']);
      await component.verifyTwoFa();
      expect(postMock).toHaveBeenCalledTimes(1);
      postMock.mockResolvedValueOnce(challengeResponse('fresh-token'));
      await component.handleSubmit();
      expect(component.preAuthToken()).toBe('fresh-token');
      expect(dialog().open).toBe(true);
    },
  );

  it.each(['login', 'verify'])(
    'ignores a pending %s response after leaving the page',
    async (stage) => {
      if (stage === 'verify') {
        await openChallenge();
        enterOtp();
      } else {
        fillForm();
      }
      let resolveRequest!: (value: AxiosResponse) => void;
      postMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      const pending = stage === 'verify' ? component.verifyTwoFa() : component.handleSubmit();
      fixture.destroy();
      resolveRequest(stage === 'verify' ? verifyResponse() : challengeResponse());
      await pending;

      expect(navigate).not.toHaveBeenCalled();
      expect(component.preAuthToken()).toBe('');
      expect(component.otpDigits()).toEqual(['', '', '', '', '', '']);
      expect(component.otpForm.getRawValue()).toEqual({ totpToken: '', rememberDevice: false });
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(sessionStorage.getItem('authSession')).toBeNull();
    },
  );

  it('does not store an incomplete session from a successful HTTP response', async () => {
    postMock.mockResolvedValueOnce(
      response({
        result: 'error',
        message: 'Sign-in was rejected.',
        data: null,
        code: 400,
      }),
    );
    fillForm();

    await component.handleSubmit();

    expect(component.errorMessage()).toBe('Sign-in was rejected.');
    expect(component.successMessage()).toBe('');
    expect(localStorage.getItem('authSession')).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it.each([undefined, '', '   '])(
    'does not authenticate a login response with an invalid sessionUid (%s)',
    async (sessionUid) => {
      postMock.mockResolvedValueOnce(
        response({
          result: 'success',
          message: 'Login successful.',
          data: { ...sessionData, sessionUid },
          code: 200,
        }),
      );
      fillForm();

      await component.handleSubmit();

      expect(component.errorMessage()).not.toBe('');
      expect(component.successMessage()).toBe('');
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(sessionStorage.getItem('authSession')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/');
    },
  );
});
