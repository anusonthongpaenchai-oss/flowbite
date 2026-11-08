import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { api, ApiError, type ApiResponse } from '../../../shared/api/api';
import { routes } from '../../app.routes';
import { Login } from '../login/login';
import { Signup } from './signup';

describe('Signup', () => {
  let component: Signup;
  let fixture: ComponentFixture<Signup>;
  const postMock = vi.fn<typeof api.post>();
  const registration = {
    firstName: 'Test',
    lastName: 'Member',
    country: 'Thailand',
    phoneCode: '+66',
    phoneNumber: '812345678',
    email: 'member@example.com',
    password: 'test-password',
    confirmPassword: 'test-password',
    referralCode: '',
    saleCode: '',
    terms: true,
  };

  function successResponse(): ApiResponse {
    return { data: { result: true, message: 'Registration successful.' } } as ApiResponse;
  }

  beforeEach(async () => {
    postMock.mockReset();
    vi.spyOn(api, 'post').mockImplementation(postMock);

    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each(['button', 'form'])('submits values entered through the native %s', async (submitVia) => {
    postMock.mockResolvedValueOnce(successResponse());
    const element = fixture.nativeElement as HTMLElement;
    const clickNext = () =>
      element.querySelector<HTMLButtonElement>('app-button[variant="primary"] button')!.click();
    const fillInputs = (values: string[]) => {
      const inputs = [...element.querySelectorAll<HTMLInputElement>('app-input input')];
      inputs.forEach((input, index) => {
        input.value = values[index];
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    clickNext();
    await fixture.whenStable();
    expect(component.page()).toBe(1);
    fillInputs([registration.firstName, registration.lastName]);
    const country = element.querySelector<HTMLSelectElement>('#signup-country')!;
    country.value = registration.country;
    country.dispatchEvent(new Event('change', { bubbles: true }));
    clickNext();
    await fixture.whenStable();
    expect(component.page()).toBe(2);

    const phone = element.querySelector<HTMLInputElement>('#signup-phone')!;
    phone.value = registration.phoneNumber;
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    fillInputs([registration.email, registration.password, registration.confirmPassword]);
    expect(
      [...element.querySelectorAll<HTMLInputElement>('app-input input')].map((input) => input.type),
    ).toEqual(['email', 'password', 'password']);
    expect(element.querySelector('.signup-phone-code')?.textContent).toContain('+66');
    expect(element.querySelector('input[name="gender"]')).toBeNull();

    if (submitVia === 'button') {
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    } else {
      const submit = new Event('submit', { bubbles: true, cancelable: true });
      element.querySelector('form')!.dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(true);
    }
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/member/register', registration);
    expect(component.successMessage()).toBe('Registration successful.');
    expect(component.errorMessage()).toBe('');
    expect(component.password).toBe('');
    expect(component.terms).toBe(false);
    expect(component.phoneCode).toBe('+66');
    expect(component.page()).toBe(0);
    expect(component.isSubmitting()).toBe(false);
  });

  it('opens login when Back is clicked on page 0 without submitting registration', async () => {
    const harness = await RouterTestingHarness.create('/signup');
    const signup = harness.routeDebugElement!.componentInstance as Signup;
    const backButton =
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.signup-back button')!;

    expect(backButton.disabled).toBe(false);
    expect(backButton.type).toBe('button');
    expect(backButton.querySelector('img')?.getAttribute('src')).toBe('svg/icon/Vector.svg');

    backButton.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Login);
    expect(signup.page()).toBe(0);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('goes back from page 2 to 1 to 0 and retains entered values', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    component.signupForm.setValue(registration);
    component.next();
    component.next();
    component.next();
    await fixture.whenStable();
    expect(component.page()).toBe(2);
    const backButton = fixture.nativeElement.querySelector(
      '.signup-back button',
    ) as HTMLButtonElement;

    component.errorMessage.set('Previous error.');
    backButton.click();
    await fixture.whenStable();
    expect(component.page()).toBe(1);
    expect(component.signupForm.getRawValue()).toEqual(registration);
    expect(component.errorMessage()).toBe('');

    backButton.click();
    await fixture.whenStable();
    expect(component.page()).toBe(0);
    expect(component.signupForm.getRawValue()).toEqual(registration);
    expect(navigate).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('validates only the current step before moving forward', () => {
    component.next();
    expect(component.page()).toBe(0);
    expect(component.signupForm.controls.terms.touched).toBe(true);
    expect(component.signupForm.controls.email.touched).toBe(false);
    component.terms = true;
    component.next();
    expect(component.page()).toBe(1);
    component.next();
    expect(component.page()).toBe(1);
    expect(component.signupForm.controls.firstName.touched).toBe(true);
    component.signupForm.patchValue({ firstName: 'Test', lastName: 'Member', country: 'Thailand' });
    component.next();
    expect(component.page()).toBe(2);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('always sends +66 even if the form phone code is changed', async () => {
    postMock.mockResolvedValueOnce(successResponse());
    component.signupForm.setValue({ ...registration, phoneCode: '+1' });
    await component.handleSubmit();
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/member/register', registration);
    expect(component.signupForm.controls.phoneCode.value).toBe('+66');
  });

  it('marks empty fields as touched without sending a request', async () => {
    await component.handleSubmit();

    expect(postMock).not.toHaveBeenCalled();
    expect(component.signupForm.controls.firstName.touched).toBe(true);
    expect(component.signupForm.controls.terms.touched).toBe(true);
    expect(component.errorMessage()).not.toBe('');
  });

  it.each([
    ['an invalid email', { email: 'invalid-email' }],
    ['different passwords', { confirmPassword: 'different-password' }],
    ['unaccepted terms', { terms: false }],
  ])('blocks submission with %s', async (_description, changes) => {
    component.signupForm.setValue(registration);
    component.signupForm.patchValue(changes);

    await component.handleSubmit();

    expect(postMock).not.toHaveBeenCalled();
    expect(component.errorMessage()).not.toBe('');
    expect(component.isSubmitting()).toBe(false);
  });

  it('blocks Back navigation and duplicate submissions while a request is pending', async () => {
    let resolveRequest!: (value: ApiResponse) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    component.signupForm.setValue(registration);

    component.next();
    component.next();
    fixture.detectChanges();
    const request = component.handleSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const backButton = fixture.nativeElement.querySelector(
      '.signup-back button',
    ) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);
    backButton.click();
    await component.back();
    expect(component.page()).toBe(2);
    expect(component.signupForm.getRawValue()).toEqual(registration);
    expect(navigate).not.toHaveBeenCalled();
    await component.handleSubmit();
    expect(postMock).toHaveBeenCalledTimes(1);

    resolveRequest(successResponse());
    await request;
    expect(component.isSubmitting()).toBe(false);
  });

  it('preserves form values and reports a registration rejection', async () => {
    postMock.mockResolvedValueOnce({
      data: { result: false, message: 'Email is already registered.' },
    } as ApiResponse);
    component.signupForm.setValue(registration);

    await component.handleSubmit();

    expect(component.errorMessage()).toBe('Email is already registered.');
    expect(component.successMessage()).toBe('');
    expect(component.email).toBe(registration.email);
  });

  it('reports the backend message for an HTTP error and allows a retry', async () => {
    postMock.mockRejectedValueOnce(
      new ApiError('Request failed', {
        status: 422,
        data: {
          message: 'Registration failed.',
          error: { message: 'Email is already registered.' },
        },
      } as ApiResponse),
    );
    component.signupForm.setValue(registration);

    await component.handleSubmit();

    expect(component.errorMessage()).toBe('Email is already registered.');
    expect(component.isSubmitting()).toBe(false);
    expect(component.email).toBe(registration.email);

    postMock.mockResolvedValueOnce(successResponse());
    await component.handleSubmit();
    expect(component.errorMessage()).toBe('');
    expect(component.successMessage()).toBe('Registration successful.');
  });

  it('handles a network failure without leaving the form loading', async () => {
    postMock.mockRejectedValueOnce(new ApiError('Network Error'));
    component.signupForm.setValue(registration);

    await component.handleSubmit();

    expect(component.errorMessage()).toContain('Unable to connect.');
    expect(component.successMessage()).toBe('');
    expect(component.isSubmitting()).toBe(false);
  });
});
