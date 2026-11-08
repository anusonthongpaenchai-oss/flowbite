import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { api, type ApiResponse } from '../../../shared/api/api';
import { clearAuthSession } from '../../../shared/guard/auth';
import { routes } from '../../app.routes';
import { Login } from '../login/login';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let component: ForgotPassword;
  let fixture: ComponentFixture<ForgotPassword>;
  const postMock = vi.fn<typeof api.post>();
  const email = 'member@example.com';

  function successResponse(message = 'Password reset instructions sent.'): ApiResponse {
    return {
      status: 200,
      data: { result: true, message, data: 'reset-reference' },
    } as ApiResponse;
  }

  function emailInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('app-input[formControlName="email"] input');
  }

  function backButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('app-button[variant="secondary"] button');
  }

  function nextButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[type="submit"]');
  }

  beforeEach(async () => {
    clearAuthSession();
    postMock.mockReset();
    vi.spyOn(api, 'post').mockImplementation(postMock);
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearAuthSession();
  });

  it('opens the page without authentication and uses the supplied illustration and Back icon', async () => {
    const harness = await RouterTestingHarness.create('/forgot-password');

    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(ForgotPassword);
    expect(TestBed.inject(Router).url).toBe('/forgot-password');
    expect(fixture.nativeElement.querySelector('main > div img')?.getAttribute('src')).toBe(
      'svg/forgotPassword/Illustration.svg',
    );
    expect(backButton().querySelector('img')?.getAttribute('src')).toBe('svg/icon/Vector.svg');
    expect(backButton().type).toBe('button');
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'invalid-email'])(
    'validates email before requesting a reset (%#)',
    async (value) => {
      component.forgotPasswordForm.controls.email.setValue(value);

      await component.onSubmit();
      fixture.detectChanges();

      expect(component.forgotPasswordForm.controls.email.touched).toBe(true);
      expect(emailInput().getAttribute('aria-invalid')).toBe('true');
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(postMock).not.toHaveBeenCalled();
    },
  );

  it('trims email before validation and sending the request', async () => {
    postMock.mockResolvedValueOnce(successResponse());
    component.forgotPasswordForm.controls.email.setValue(`  ${email}  `);

    await component.onSubmit();

    expect(component.forgotPasswordForm.controls.email.value).toBe(email);
    expect(postMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/auth/forgot-password',
      { email },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it.each(['button', 'form'])(
    'submits the email entered through formControlName via the native %s',
    async (submitVia) => {
      postMock.mockResolvedValueOnce(successResponse());
      emailInput().value = email;
      emailInput().dispatchEvent(new Event('input', { bubbles: true }));

      if (submitVia === 'button') {
        nextButton().click();
      } else {
        fixture.nativeElement
          .querySelector('form')
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(
        '/v1/auth/forgot-password',
        { email },
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      expect(component.successMessage()).toBe('Password reset instructions sent.');
    },
  );

  it('locks the form and ignores duplicate submissions while a request is pending', async () => {
    let resolveRequest!: (response: ApiResponse) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    component.forgotPasswordForm.controls.email.setValue(email);

    const request = component.onSubmit();
    fixture.detectChanges();

    expect(emailInput().readOnly).toBe(true);
    expect(backButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(true);
    expect(nextButton().textContent).toContain('Sending…');
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('true');
    nextButton().click();
    await component.onSubmit();
    expect(postMock).toHaveBeenCalledTimes(1);

    resolveRequest(successResponse());
    await request;
  });

  it('shows success for two seconds before replacing the page with login and blocks resubmission', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    postMock.mockResolvedValueOnce(successResponse());
    component.forgotPasswordForm.controls.email.setValue(email);

    await component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Password reset instructions sent.',
    );
    expect(component.isSubmitting()).toBe(false);
    expect(emailInput().readOnly).toBe(true);
    expect(backButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(true);
    await component.onSubmit();
    expect(postMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/', { replaceUrl: true });
  });

  it('uses a success message when the API returns an empty message', async () => {
    postMock.mockResolvedValueOnce(successResponse('   '));
    component.forgotPasswordForm.controls.email.setValue(email);

    await component.onSubmit();

    expect(component.successMessage()).toBe(
      'Password reset instructions sent. Please check your email.',
    );
  });

  it('shows API errors, retains email, and allows another attempt', async () => {
    postMock.mockResolvedValueOnce({
      status: 422,
      data: { message: 'Please try again later.', result: false },
    } as ApiResponse);
    component.forgotPasswordForm.controls.email.setValue(email);

    await component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Please try again later.',
    );
    expect(emailInput().value).toBe(email);
    expect(emailInput().readOnly).toBe(false);
    expect(backButton().disabled).toBe(false);
    expect(nextButton().disabled).toBe(false);

    postMock.mockResolvedValueOnce(successResponse());
    await component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(component.successMessage()).toBe('Password reset instructions sent.');
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('reports a network failure and unlocks the form', async () => {
    postMock.mockRejectedValueOnce(new Error('Network Error'));
    component.forgotPasswordForm.controls.email.setValue(email);

    await component.onSubmit();

    expect(component.errorMessage()).toContain('Unable to connect.');
    expect(component.isBusy()).toBe(false);
    expect(component.forgotPasswordForm.controls.email.value).toBe(email);
  });

  it('cancels a scheduled redirect when the page is destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    postMock.mockResolvedValueOnce(successResponse());
    component.forgotPasswordForm.controls.email.setValue(email);

    await component.onSubmit();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(2000);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not schedule a redirect when a request finishes after leaving the page', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    let resolveRequest!: (response: ApiResponse) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    component.forgotPasswordForm.controls.email.setValue(email);

    const request = component.onSubmit();
    fixture.destroy();
    resolveRequest(successResponse());
    await request;
    await vi.advanceTimersByTimeAsync(2000);

    expect(component.successMessage()).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns to login when Back is clicked without sending a reset request', async () => {
    const harness = await RouterTestingHarness.create('/forgot-password');
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>(
        'app-button[variant="secondary"] button',
      )!
      .click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
    expect(postMock).not.toHaveBeenCalled();
  });
});
