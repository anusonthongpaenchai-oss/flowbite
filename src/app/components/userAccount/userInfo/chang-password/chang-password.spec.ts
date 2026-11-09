import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { api, ApiError, type ApiResponse } from '../../../../../shared/api/api';
import { clearAuthSession, getAuthSession, setAuthSession } from '../../../../../shared/guard/auth';
import { ChangPassword } from './chang-password';

describe('ChangPassword', () => {
  let component: ChangPassword;
  let fixture: ComponentFixture<ChangPassword>;
  const postMock = vi.fn<typeof api.post>();
  const putMock = vi.fn<typeof api.put>();
  const passwords = {
    currentPassword: 'current-password',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  };

  function response(data: unknown, status = 200): ApiResponse {
    return { data, status } as ApiResponse;
  }

  function otpResponse(): ApiResponse {
    return response({
      message: 'OTP sent.',
      memberRef: 'unused-top-level-reference',
      data: { memberRef: 'otp-member-reference', expiresAt: new Date() },
    });
  }

  function backendError(message: string, responseMessage = 'Request failed.'): ApiError {
    return new ApiError(
      'Request failed',
      response({ result: false, message: responseMessage, error: { code: 'OTP', message } }, 422),
    );
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
    postMock.mockReset().mockResolvedValue(otpResponse());
    putMock.mockReset().mockResolvedValue(response({ result: true, message: 'Password changed.' }));
    vi.spyOn(api, 'post').mockImplementation(postMock);
    vi.spyOn(api, 'put').mockImplementation(putMock);
    clearAuthSession();
    setAuthSession({
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
      accessToken: 'test-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });

    await TestBed.configureTestingModule({
      imports: [ChangPassword],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  function input(name: string): HTMLInputElement {
    if (name === 'otpCode') {
      return fixture.nativeElement.querySelector('.otp-digit');
    }
    return fixture.nativeElement.querySelector(`app-input[formControlName="${name}"] input`);
  }

  function fillInput(name: string, value: string): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function button(text: string): HTMLButtonElement | undefined {
    const element = fixture.nativeElement as HTMLElement;
    return Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === text,
    );
  }

  function fillPasswords(method: 'sms' | 'email' = 'sms'): void {
    for (const [name, value] of Object.entries(passwords)) {
      fillInput(name, value);
    }
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = method;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('starts with SMS selected and only shows OTP and Verify after sending', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('dialog')!.open).toBe(true);
    expect(element.querySelector('h2')!.textContent?.trim()).toBe('Change Password');
    expect(component.passwordForm.controls.otpMethod.value).toBe('sms');
    expect(Array.from(element.querySelectorAll('option')).map((option) => option.value)).toEqual([
      'sms',
      'email',
    ]);
    expect(input('otpCode')).toBeNull();
    expect(button('Next')).toBeDefined();
    expect(button('Verify')).toBeUndefined();

    await component.onSave();

    expect(postMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it.each(['sms', 'email'] as const)(
    'sends %s OTP on Next and changes the password only on Verify',
    async (method) => {
      const changed = vi.spyOn(component.passwordChanged, 'emit');
      fillPasswords(method);
      expect(postMock).not.toHaveBeenCalled();

      button('Next')!.click();
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(`/v1/verify/${method}/send`);
      expect(putMock).not.toHaveBeenCalled();
      expect(button('Next')).toBeUndefined();
      expect(button('Verify')).toBeDefined();
      expect(fixture.nativeElement.querySelectorAll('.otp-digit')).toHaveLength(6);
      expect(fixture.nativeElement.querySelector('#otp-help').textContent).toContain(
        method === 'sms' ? 'SMS' : 'email',
      );
      expect(input('currentPassword')).toBeNull();
      expect(component.passwordForm.controls.currentPassword.disabled).toBe(true);
      expect(component.passwordForm.controls.newPassword.disabled).toBe(true);
      expect(component.passwordForm.controls.confirmPassword.disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('select')).toBeNull();
      expect(input('otpCode').type).toBe('text');
      expect(input('otpCode').disabled).toBe(false);

      fillInput('otpCode', '001234');
      expect(putMock).not.toHaveBeenCalled();
      button('Verify')!.click();
      await fixture.whenStable();

      expect(putMock).toHaveBeenCalledExactlyOnceWith('/v1/member/change-password', {
        ...passwords,
        otpMethod: method,
        memberRef: 'otp-member-reference',
        otpCode: '001234',
        token: '',
      });
      expect(changed).toHaveBeenCalledOnce();
    },
  );

  it.each([
    {
      name: 'both passwords reuse the old password',
      fields: {
        ...passwords,
        newPassword: passwords.currentPassword,
        confirmPassword: passwords.currentPassword,
      },
      messages: [
        'New password must be different from your old password.',
        'Confirm password must be different from your old password.',
      ],
    },
    {
      name: 'only the new password reuses the old password',
      fields: { ...passwords, newPassword: passwords.currentPassword },
      messages: [
        'New password must be different from your old password.',
        'Passwords do not match.',
      ],
    },
    {
      name: 'only the confirmation reuses the old password',
      fields: { ...passwords, confirmPassword: passwords.currentPassword },
      messages: ['Confirm password must be different from your old password.'],
    },
    {
      name: 'the new passwords do not match',
      fields: { ...passwords, confirmPassword: 'different-password' },
      messages: ['Passwords do not match.'],
    },
  ])('shows field errors and does not send OTP when $name', async ({ fields, messages }) => {
    for (const [name, value] of Object.entries(fields)) {
      fillInput(name, value);
    }
    await fixture.whenStable();

    button('Next')!.click();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(element.querySelectorAll('[role="alert"]')).map((error) =>
        error.textContent?.trim(),
      ),
    ).toEqual(messages);
    expect(element.querySelectorAll('input[aria-invalid="true"]')).toHaveLength(messages.length);
    expect(postMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
    expect(component.otpSent()).toBe(false);
    expect(component.isBusy()).toBe(false);
    expect(input('newPassword').disabled).toBe(false);
    expect(button('Next')!.disabled).toBe(false);
  });

  it.each([
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    { ...passwords, currentPassword: '' },
    { ...passwords, newPassword: '' },
    { ...passwords, confirmPassword: '' },
  ])('blocks Next without showing a missing-password alert', async (fields) => {
    for (const [name, value] of Object.entries(fields)) {
      fillInput(name, value);
    }
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(button('Next')!.disabled).toBe(true);
    expect(element.querySelector('[role="alert"]')).toBeNull();

    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(postMock).not.toHaveBeenCalled();
    expect(component.otpSent()).toBe(false);

    fillPasswords();
    await fixture.whenStable();

    expect(button('Next')!.disabled).toBe(false);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('clears field errors as the new passwords are corrected and then sends OTP', async () => {
    fillPasswords();
    fillInput('newPassword', passwords.currentPassword);
    fillInput('confirmPassword', passwords.currentPassword);
    button('Next')!.click();
    await fixture.whenStable();
    expect(postMock).not.toHaveBeenCalled();

    fillInput('newPassword', passwords.newPassword);
    await fixture.whenStable();

    expect(input('newPassword').getAttribute('aria-invalid')).toBeNull();
    expect(input('confirmPassword').getAttribute('aria-invalid')).toBe('true');

    fillInput('confirmPassword', passwords.confirmPassword);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    button('Next')!.click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
    expect(component.otpSent()).toBe(true);
  });

  it('revalidates both new password fields when the old password changes', async () => {
    fillPasswords();
    fillInput('currentPassword', passwords.newPassword);
    button('Next')!.click();
    await fixture.whenStable();
    expect(postMock).not.toHaveBeenCalled();

    fillInput('currentPassword', passwords.currentPassword);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    button('Next')!.click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledOnce();
    expect(component.otpSent()).toBe(true);
  });

  it('does not save if password values become invalid after sending OTP', async () => {
    fillPasswords();
    await component.onNext();
    component.passwordForm.controls.newPassword.setValue(passwords.currentPassword);

    await component.onSave();

    expect(putMock).not.toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);
    expect(getAuthSession()).not.toBeNull();
  });

  it.each([
    ['sms', 'backend'],
    ['sms', 'network'],
    ['email', 'backend'],
    ['email', 'network'],
  ] as const)(
    'keeps the first step after a %s %s error and allows retry',
    async (method, failure) => {
      fillPasswords(method);
      postMock.mockRejectedValueOnce(
        failure === 'backend'
          ? backendError('Internal error.', 'Unable to deliver OTP.')
          : new ApiError('Network Error'),
      );

      button('Next')!.click();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        failure === 'backend' ? 'Unable to deliver OTP.' : 'Please try again.',
      );
      expect(component.otpSent()).toBe(false);
      expect(input('otpCode')).toBeNull();
      expect(input('currentPassword').value).toBe(passwords.currentPassword);
      expect(input('currentPassword').disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('select').disabled).toBe(false);
      expect(button('Next')!.disabled).toBe(false);
      expect(putMock).not.toHaveBeenCalled();

      button('Next')!.click();
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledTimes(2);
      expect(component.otpSent()).toBe(true);
      expect(component.errorMessage()).toBe('');
    },
  );

  it.each(['backend', 'result', 'network'])(
    'keeps the OTP step after a save %s error and allows retry',
    async (failure) => {
      const changed = vi.spyOn(component.passwordChanged, 'emit');
      fillPasswords();
      await component.onNext();
      await fixture.whenStable();
      fillInput('otpCode', '001234');
      if (failure === 'result') {
        putMock.mockResolvedValueOnce(response({ result: false, message: 'OTP was rejected.' }));
      } else {
        putMock.mockRejectedValueOnce(
          failure === 'backend'
            ? backendError('OTP was rejected.')
            : new ApiError('Network Error'),
        );
      }

      button('Verify')!.click();
      await fixture.whenStable();

      expect(component.otpSent()).toBe(true);
      expect(component.isSaving()).toBe(false);
      expect(component.passwordForm.controls.otpCode.value).toBe('001234');
      expect(input('otpCode').disabled).toBe(false);
      expect(component.passwordForm.controls.currentPassword.disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        failure === 'network' ? 'Please try again.' : 'OTP was rejected.',
      );
      expect(changed).not.toHaveBeenCalled();
      expect(getAuthSession()).not.toBeNull();

      button('Verify')!.click();
      await fixture.whenStable();

      expect(putMock).toHaveBeenCalledTimes(2);
      expect(postMock).toHaveBeenCalledOnce();
      expect(component.errorMessage()).toBe('');
      expect(changed).toHaveBeenCalledOnce();
    },
  );

  it('does not send OTP without authentication', async () => {
    fillPasswords();
    clearAuthSession();

    await component.onNext();

    expect(postMock).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Please sign in');
    expect(component.otpSent()).toBe(false);
  });

  it('does not change the password if the session is cleared after sending OTP', async () => {
    const changed = vi.spyOn(component.passwordChanged, 'emit');
    fillPasswords();
    await component.onNext();
    clearAuthSession();

    await component.onSave();

    expect(putMock).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Please sign in');
    expect(component.otpSent()).toBe(true);
  });

  it('blocks duplicate sends, saving, and cancellation while sending OTP', async () => {
    fillPasswords();
    const closed = vi.spyOn(component.closed, 'emit');
    let resolveRequest!: (value: ApiResponse) => void;
    postMock.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)));

    button('Next')!.click();
    fixture.detectChanges();
    await component.onNext();
    await component.onSave();
    component.close();

    expect(postMock).toHaveBeenCalledOnce();
    expect(putMock).not.toHaveBeenCalled();
    expect(button('Sending...')!.disabled).toBe(true);
    expect(button('Back')!.disabled).toBe(true);
    expect(input('currentPassword').disabled).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    resolveRequest(otpResponse());
    await fixture.whenStable();

    expect(component.isBusy()).toBe(false);
    expect(button('Verify')!.disabled).toBe(false);
  });

  it('blocks duplicate saves and cancellation while changing the password', async () => {
    const closed = vi.spyOn(component.closed, 'emit');
    const changed = vi.spyOn(component.passwordChanged, 'emit');
    fillPasswords();
    await component.onNext();
    await fixture.whenStable();
    let resolveRequest!: (value: ApiResponse) => void;
    putMock.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)));

    button('Verify')!.click();
    fixture.detectChanges();
    await component.onSave();
    await component.onNext();
    component.close();

    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledOnce();
    expect(button('Verifying...')!.disabled).toBe(true);
    expect(button('Back')!.disabled).toBe(true);
    expect(input('otpCode').disabled).toBe(true);
    expect(closed).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();

    resolveRequest(response({ result: true, message: 'Password changed.' }));
    await fixture.whenStable();

    expect(changed).toHaveBeenCalledOnce();
    expect(component.isBusy()).toBe(false);
  });

  it('emits closed when Back is clicked from the password step without making requests', () => {
    const closed = vi.spyOn(component.closed, 'emit');

    button('Back')!.click();

    expect(closed).toHaveBeenCalledOnce();
    expect(postMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('advances between OTP boxes and supports pasting, arrow keys, and backspace', async () => {
    fillPasswords();
    await component.onNext();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const digits = Array.from(element.querySelectorAll<HTMLInputElement>('.otp-digit'));
    expect(document.activeElement).toBe(digits[0]);

    digits[0].value = '0';
    digits[0].dispatchEvent(new Event('input'));
    expect(document.activeElement).toBe(digits[1]);

    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => '001234' },
    });
    digits[1].dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(digits.map((digit) => digit.value)).toEqual(['0', '0', '1', '2', '3', '4']);
    expect(component.passwordForm.controls.otpCode.value).toBe('001234');
    expect(document.activeElement).toBe(digits[5]);
    expect(putMock).not.toHaveBeenCalled();

    digits[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(digits[4]);
    digits[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(digits[5]);
    digits[5].value = '';
    digits[5].dispatchEvent(new Event('input'));
    digits[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));

    expect(document.activeElement).toBe(digits[4]);
    expect(digits[4].value).toBe('');
    expect(component.passwordForm.controls.otpCode.value).toBe('0012');
  });

  it('returns to the password step and uses a fresh reference after changing the OTP method', async () => {
    fillPasswords();
    await component.onNext();
    await fixture.whenStable();
    fillInput('otpCode', '001234');

    button('Back')!.click();
    await fixture.whenStable();

    expect(component.otpSent()).toBe(false);
    expect(component.passwordForm.controls.otpCode.value).toBe('');
    expect(input('currentPassword').value).toBe(passwords.currentPassword);
    expect(input('currentPassword').disabled).toBe(false);
    expect(input('otpCode')).toBeNull();
    fillPasswords('email');
    postMock.mockResolvedValueOnce(response({ data: { memberRef: 'new-email-reference' } }));
    button('Next')!.click();
    await fixture.whenStable();
    fillInput('otpCode', '005678');
    button('Verify')!.click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenNthCalledWith(2, '/v1/verify/email/send');
    expect(putMock).toHaveBeenCalledExactlyOnceWith('/v1/member/change-password', {
      ...passwords,
      otpMethod: 'email',
      memberRef: 'new-email-reference',
      otpCode: '005678',
      token: '',
    });
  });

  it('closes on the dialog cancel event', () => {
    const closed = vi.spyOn(component.closed, 'emit');
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const event = new Event('cancel', { cancelable: true });

    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });

  it('closes only when clicking outside the dialog bounds', () => {
    const closed = vi.spyOn(component.closed, 'emit');
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 580,
      top: 100,
      bottom: 600,
    } as DOMRect);

    dialog.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150 }));
    expect(closed).not.toHaveBeenCalled();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));

    expect(closed).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });
});
