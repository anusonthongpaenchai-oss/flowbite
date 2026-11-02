import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { AxiosResponse } from 'axios';
import { api } from '../../../shared/api/api';
import { Login } from './login';

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

  function fillForm(rememberMe = false): void {
    component.loginForm.setValue({
      email: 'member@example.com',
      password: 'test-password',
      rememberMe,
    });
  }

  beforeEach(async () => {
    postMock.mockReset();
    vi.spyOn(api, 'post').mockImplementation(postMock);
    localStorage.removeItem('authSession');
    sessionStorage.removeItem('authSession');

    await TestBed.configureTestingModule({
      imports: [Login],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.removeItem('authSession');
    sessionStorage.removeItem('authSession');
    vi.restoreAllMocks();
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

      expect(JSON.parse(selectedStorage.getItem('authSession')!)).toEqual(sessionData);
      expect(otherStorage.getItem('authSession')).toBeNull();
      expect(selectedStorage.getItem('authSession')).not.toContain('test-password');
      expect(component.password).toBe('');
      expect(component.successMessage()).not.toBe('');
      expect(component.isSubmitting()).toBe(false);
    },
  );

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

  it('does not authenticate a response that requires two-factor verification', async () => {
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
  });

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
});
