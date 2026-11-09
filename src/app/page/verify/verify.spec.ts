import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../../../shared/api/api';
import type { KycResponse } from '../../../shared/api/kyc/getKyc';
import type { UserInfoResponse } from '../../../shared/api/userInfo/userInfo';
import {
  clearAuthSession,
  getAuthSession,
  getRememberedAuthSession,
  setAuthSession,
} from '../../../shared/guard/auth';
import { GoogleAuth } from '../../components/userAccount/google-auth/google-auth';
import { Verify } from './verify';

describe('Verify KYC flow', () => {
  let component: Verify;
  let fixture: ComponentFixture<Verify>;
  const getMock = vi.fn<typeof api.get>();
  const putMock = vi.fn<typeof api.put>();
  const postMock = vi.fn<typeof api.post>();
  const navigateMock = vi.fn<Router['navigateByUrl']>();
  const member = {
    id: 1,
    username: 'member',
    email: 'member@example.com',
    m_image_url: '',
    m_name: 'Test',
    m_lastname: 'Member',
    m_phone: '0812345678',
    m_phone_code: '+66',
    m_gender: 'male',
    m_birthdate: '1990-01-15T00:00:00.000Z',
    m_nationality: 'Thai',
    m_country: 'Thailand',
    m_state: 'Bangkok',
    m_identity: '',
    isActive: 1,
    isConfirm: 1,
    isKYC: 0 as const,
    campaign_name: '',
    lastLogin: '2026-11-03T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    ib: 0,
    ibType: 0,
    mt5_category: 0,
    member_roles: [],
  };
  const address = {
    address_no: '123 Main Road',
    address_district: 'Khlong Tan Nuea',
    address_city: 'Watthana',
    address_state: 'Bangkok',
    address_zipcode: '10110',
  };
  const profile: UserInfoResponse = {
    result: true,
    message: 'Profile retrieved.',
    data: {
      member,
      address: {
        ...address,
        id: 1,
        member_id: 1,
        address_stat: 1,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-03T00:00:00.000Z',
      },
      isTrusted: false,
    },
  };
  const formMember = {
    m_name: member.m_name,
    m_lastname: member.m_lastname,
    m_phone: member.m_phone,
    m_gender: member.m_gender,
    m_country: member.m_country,
    m_birthdate: '1990-01-15',
  };

  function response(data: unknown, status = 200): AxiosResponse {
    return { data, status } as AxiosResponse;
  }

  function kycResponse(status = 3): KycResponse {
    return {
      result: true,
      message: 'KYC retrieved.',
      data: {
        id: 1,
        member_id: 1,
        kyc_type: '',
        kyc_id: null,
        kyc_id_type: null,
        kyc_image: '',
        kyc_image_url: '',
        kyc_image_session: 0,
        kyc_stat: status,
        kyc_stat_text: 'None',
        kyc_reason: '',
        kyc_note: '',
        admin_id: null,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-03T00:00:00.000Z'),
      },
    };
  }

  function sentOtp(memberRef = 'nested-otp-reference'): AxiosResponse {
    return response({
      message: 'OTP sent.',
      memberRef: 'unused-top-level-reference',
      data: { memberRef, expiresAt: '2026-11-05T07:00:00.000Z' },
    });
  }

  function uploadedImage(): AxiosResponse {
    return response({
      result: true,
      message: 'KYC image submitted.',
      data: { kycIdType: 'Passport', imageUrl: 'https://example.com/id.png' },
    });
  }

  function backendError(message: string, responseMessage = 'Request failed.'): AxiosError {
    return new AxiosError(
      'Request failed.',
      AxiosError.ERR_BAD_REQUEST,
      undefined,
      undefined,
      response({ result: false, message: responseMessage, error: { code: 'OTP', message } }, 422),
    );
  }

  function deferredResponse() {
    let resolve!: (value: AxiosResponse) => void;
    const promise = new Promise<AxiosResponse>((complete) => (resolve = complete));
    return { promise, resolve };
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
    getMock.mockReset().mockImplementation(async (url) => {
      if (url === '/v1/verify/kyc') return response(kycResponse());
      if (url === '/v1/member/profile') return response(profile);
      throw new Error(`Unexpected GET: ${url}`);
    });
    putMock.mockReset().mockResolvedValue(response({ result: true, message: 'Profile updated.' }));
    postMock.mockReset().mockImplementation(async (url) => {
      if (url === '/v1/verify/sms/send') return sentOtp();
      if (url === '/v1/verify/email/send') return sentOtp('email-otp-reference');
      if (url === '/v1/verify/sms/verify' || url === '/v1/verify/email/verify')
        return response({ result: true, message: 'OTP verified.' });
      if (url === '/v1/verify/kyc/image') return uploadedImage();
      throw new Error(`Unexpected POST: ${url}`);
    });
    vi.spyOn(api, 'get').mockImplementation(getMock);
    vi.spyOn(api, 'put').mockImplementation(putMock);
    vi.spyOn(api, 'post').mockImplementation(postMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearAuthSession();
    setAuthSession({
      require2FA: false,
      member: { ...member, m_image_path: '' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });
    await TestBed.configureTestingModule({
      imports: [Verify],
      providers: [provideRouter([])],
    }).compileComponents();
    navigateMock.mockReset().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateMock);
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(Verify);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function input(name: string): HTMLInputElement | HTMLSelectElement | null {
    if (name === 'otpCode') {
      return fixture.nativeElement.querySelector('.otp-digit');
    }
    return fixture.nativeElement.querySelector(
      `app-input[formControlName="${name}"] input, select[formControlName="${name}"]`,
    );
  }

  function imageInput(): HTMLInputElement | null {
    return fixture.nativeElement.querySelector('input[type="file"]');
  }

  function verificationDialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector('dialog');
  }

  function otpMethodSelect(): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector('#kyc-otp-method');
  }

  function selectOtpMethod(method: 'sms' | 'email'): void {
    const select = otpMethodSelect()!;
    select.value = method;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function button(text: string): HTMLButtonElement | undefined {
    const scope = verificationDialog() ?? (fixture.nativeElement as HTMLElement);
    return Array.from(scope.querySelectorAll('button')).find(
      (element) => element.textContent?.trim() === text,
    );
  }

  function useProfile(value: UserInfoResponse): void {
    getMock.mockImplementation(async (url) =>
      response(url === '/v1/verify/kyc' ? kycResponse() : value),
    );
  }

  it.each([
    [0, 'KYC Pending'],
    [1, 'KYC Approved'],
    [2, 'KYC Rejected'],
    [3, 'KYC Verification'],
  ] as const)(
    'shows both cards together after loading KYC status %s without a loading message',
    async (status, title) => {
      const pending = deferredResponse();
      getMock.mockReturnValueOnce(pending.promise);
      const element = render();
      expect(element.querySelector('app-verify-status')).toBeNull();
      expect(element.querySelector('app-google-auth')).toBeNull();
      expect(element.textContent).not.toContain('Loading KYC data...');
      expect(component.isVerificationOpen()).toBe(false);

      pending.resolve(response(kycResponse(status)));
      await fixture.whenStable();

      expect(element.querySelector('app-verify-status h3')?.textContent?.trim()).toBe(title);
      expect(element.querySelector('app-google-auth')).not.toBeNull();
    },
  );

  it('renders Google Authenticator beside KYC and opens its own preparation dialog', async () => {
    const element = render();
    await fixture.whenStable();
    const auth = element.querySelector('app-google-auth')!;
    expect(element.querySelector('app-verify-status')).not.toBeNull();
    expect(auth.textContent).toContain('Enable Two-Factor Authentication');
    auth.querySelector('button')!.click();
    await fixture.whenStable();
    expect(auth.querySelector('dialog')?.textContent).toContain('Things you need to prepare');
    expect(component.isVerificationOpen()).toBe(false);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('shows Already Verify from the saved login challenge state without offering setup', async () => {
    setAuthSession({ ...getAuthSession()!, twoFaEnabled: true });
    const element = render();
    await fixture.whenStable();
    const auth = element.querySelector('app-google-auth')!;
    expect(auth.textContent).toContain('Already Verify');
    expect(auth.querySelector('button')).toBeNull();
    expect(component.require2fa()).toBe(true);
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'persists completed setup across page recreation, Remember me = %s',
    async (rememberMe) => {
      setAuthSession(getAuthSession()!, rememberMe);
      render();
      await fixture.whenStable();
      const auth = fixture.debugElement.query(By.directive(GoogleAuth))
        .componentInstance as GoogleAuth;
      auth.require2fa.set(true);
      await fixture.whenStable();
      expect(getAuthSession()?.twoFaEnabled).toBe(true);
      expect(getRememberedAuthSession() !== null).toBe(rememberMe);
      fixture.destroy();
      const element = render();
      await fixture.whenStable();
      expect(element.querySelector('app-google-auth')?.textContent).toContain('Already Verify');
    },
  );

  async function load(): Promise<HTMLElement> {
    const element = render();
    await fixture.whenStable();
    if (component.profileLoaded()) {
      component.startVerification();
      await fixture.whenStable();
    }
    return element;
  }

  async function enterOtp(): Promise<void> {
    await load();
    await component.onUpdateProfile();
    await fixture.whenStable();
  }

  async function enterImageStage(): Promise<void> {
    useProfile({
      ...profile,
      data: { ...profile.data, member: { ...member, m_phone_code: '+1' } },
    });
    await load();
    await component.onUpdateProfile();
    await fixture.whenStable();
  }

  function selectIdType(value: string): void {
    const select = fixture.nativeElement.querySelector('#kyc-id-type') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function selectImageFile(file: File): void {
    const fileInput = imageInput()!;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('opens preparation only after clicking Verify and starts the prefilled form on Start Verify', async () => {
    const element = render();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(false);
    expect(verificationDialog()).toBeNull();
    expect(element.querySelector('app-verify-status')).not.toBeNull();
    expect(button('Verify')).toBeDefined();
    expect(button('Start Verify')).toBeUndefined();
    button('Verify')!.click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(true);
    expect(verificationDialog().open).toBe(true);
    expect(component.hasStarted()).toBe(false);
    expect(element.querySelector('form')).toBeNull();
    expect(button('Start Verify')).toBeDefined();
    button('Start Verify')!.click();
    await fixture.whenStable();

    expect(component.hasStarted()).toBe(true);
    expect(component.step()).toBe('profile');
    expect(input('m_name')?.value).toBe('Test');
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('opens ID proof directly on Try again for rejected KYC without loading profile or sending requests', async () => {
    getMock.mockResolvedValueOnce(response(kycResponse(2)));
    const element = render();
    await fixture.whenStable();

    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/kyc');
    expect(component.profileLoaded()).toBe(false);
    expect(component.isVerificationOpen()).toBe(false);
    expect(verificationDialog()).toBeNull();
    expect(element.querySelector('app-verify-status')).not.toBeNull();
    expect(button('Try again')).toBeDefined();

    button('Try again')!.click();
    await fixture.whenStable();

    expect(verificationDialog().open).toBe(true);
    expect(component.isVerificationOpen()).toBe(true);
    expect(component.hasStarted()).toBe(true);
    expect(component.step()).toBe('id-proof');
    expect(imageInput()).not.toBeNull();
    expect(button('Start Verify')).toBeUndefined();
    expect(input('m_name')).toBeNull();
    expect(input('otpCode')).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('prevents rejected KYC from calling profile update, sending OTP, or verifying OTP', async () => {
    getMock.mockResolvedValueOnce(response(kycResponse(2)));
    render();
    await fixture.whenStable();

    button('Try again')!.click();
    await fixture.whenStable();

    await component.onUpdateProfile();
    await component.sendOtp();
    await component.onVerifyOtp();
    component.setOtpMethod('email');

    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
    expect(component.step()).toBe('id-proof');
  });

  it('preserves drafts on Back, close and reopen for rejected KYC flow', async () => {
    getMock.mockResolvedValueOnce(response(kycResponse(2)));
    render();
    await fixture.whenStable();

    button('Try again')!.click();
    await fixture.whenStable();

    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));

    button('Back')!.click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(false);
    expect(verificationDialog()?.open ?? false).toBe(false);

    button('Try again')!.click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(true);
    expect(component.step()).toBe('id-proof');
    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(component.idImagePreview()).not.toBe('');

    fixture.nativeElement.querySelector('button[aria-label="Close KYC verification"]').click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(false);

    button('Try again')!.click();
    await fixture.whenStable();

    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('submits rejected KYC image with two FormData fields, blocks duplicate submissions, and refreshes status', async () => {
    getMock.mockResolvedValueOnce(response(kycResponse(2)));
    render();
    await fixture.whenStable();

    button('Try again')!.click();
    await fixture.whenStable();

    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));

    const pending = deferredResponse();
    postMock.mockReturnValueOnce(pending.promise);
    let resolveNavigation!: (result: boolean) => void;
    navigateMock.mockReturnValueOnce(new Promise((resolve) => (resolveNavigation = resolve)));

    const upload = component.onSubmitImage();
    fixture.detectChanges();

    await component.onSubmitImage();
    expect(postMock).toHaveBeenCalledOnce();
    expect(component.isUploadingImage()).toBe(true);
    expect(button('Uploading...')?.disabled).toBe(true);

    pending.resolve(uploadedImage());
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledOnce());

    getMock.mockResolvedValueOnce(response(kycResponse(0)));
    resolveNavigation(true);
    await upload;
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/verify/kyc/image',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': null } }),
    );
    const body = postMock.mock.calls[0][1] as FormData;
    expect(Array.from(body.keys()).sort()).toEqual(['kycIdType', 'kycImage']);
    expect(body.get('kycImage')).toBe(file);
    expect(body.get('kycIdType')).toBe('Passport');
    expect(navigateMock).toHaveBeenCalledExactlyOnceWith('/user/verify', { replaceUrl: true });
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(component.kycDetail()?.data.kyc_stat).toBe(0);
    expect(component.isVerificationOpen()).toBe(false);
  });

  it('preserves file, document type, and error message when submission fails in reject flow', async () => {
    getMock.mockResolvedValueOnce(response(kycResponse(2)));
    render();
    await fixture.whenStable();

    button('Try again')!.click();
    await fixture.whenStable();

    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));

    postMock.mockRejectedValueOnce(backendError('Document image was rejected.'));
    await component.onSubmitImage();
    await fixture.whenStable();

    expect(component.step()).toBe('id-proof');
    expect(component.errorMessage()).toBe('Document image was rejected.');
    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(component.idImagePreview()).not.toBe('');
    expect(navigateMock).not.toHaveBeenCalled();

    button('Back')!.click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(false);
    expect(verificationDialog()?.open ?? false).toBe(false);

    button('Try again')!.click();
    await fixture.whenStable();

    expect(component.step()).toBe('id-proof');
    expect(component.errorMessage()).toBe('Document image was rejected.');
    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(component.idImagePreview()).not.toBe('');

    getMock.mockResolvedValueOnce(response(kycResponse(0)));
    await component.onSubmitImage();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledOnce();
    expect(component.kycDetail()?.data.kyc_stat).toBe(0);
  });

  it('preserves profile drafts when closing, reopening and cancelling the dialog', async () => {
    await load();
    const firstName = input('m_name')!;
    firstName.value = 'Changed';
    firstName.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[aria-label="Close KYC verification"]').click();
    await fixture.whenStable();

    expect(component.isVerificationOpen()).toBe(false);
    expect(verificationDialog()?.open ?? false).toBe(false);
    component.openVerification();
    await fixture.whenStable();
    expect(verificationDialog().open).toBe(true);
    expect(input('m_name')?.value).toBe('Changed');
    const cancel = new Event('cancel', { cancelable: true });
    verificationDialog().dispatchEvent(cancel);
    await fixture.whenStable();
    expect(cancel.defaultPrevented).toBe(true);
    expect(component.isVerificationOpen()).toBe(false);
    expect(component.profileForm.controls.member.controls.m_name.value).toBe('Changed');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('returns from the profile to preparation without discarding draft values', async () => {
    await load();
    component.profileForm.controls.member.controls.m_name.setValue('Changed');
    button('Back')!.click();
    await fixture.whenStable();

    expect(component.hasStarted()).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    button('Start Verify')!.click();
    await fixture.whenStable();
    expect(input('m_name')?.value).toBe('Changed');
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it('loads KYC before the profile and prefills every editable field', async () => {
    await load();

    expect(getMock).toHaveBeenNthCalledWith(1, '/v1/verify/kyc');
    expect(getMock).toHaveBeenNthCalledWith(2, '/v1/member/profile');
    expect(component.profileForm.getRawValue()).toEqual({ member: formMember, address });
    for (const [field, value] of Object.entries({ ...formMember, ...address })) {
      expect(input(field)?.value).toBe(value);
    }
    expect(input('m_birthdate')?.type).toBe('date');
    expect(component.profileLoaded()).toBe(true);
    expect(component.step()).toBe('profile');
    expect(input('otpCode')).toBeNull();
    expect(imageInput()).toBeNull();
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each([0, 1])('does not start the flow for KYC status %s', async (status) => {
    getMock.mockResolvedValueOnce(response(kycResponse(status)));
    const element = await load();
    await component.onUpdateProfile();
    await component.sendOtp();
    await component.onVerifyOtp();
    await component.onSubmitImage();

    expect(getMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/kyc');
    expect(component.profileLoaded()).toBe(false);
    expect(element.querySelector('form')).toBeNull();
    expect(imageInput()).toBeNull();
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('allows entering a missing address and birthdate without inventing defaults', async () => {
    useProfile({
      ...profile,
      data: { ...profile.data, member: { ...member, m_birthdate: null }, address: null },
    });
    await load();

    expect(input('m_name')?.value).toBe('Test');
    expect(input('m_birthdate')?.value).toBe('');
    for (const field of Object.keys(address)) expect(input(field)?.value).toBe('');
    expect(component.profileForm.invalid).toBe(true);
    await component.onUpdateProfile();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('waits for the profile before showing both cards and ignores a duplicate load', async () => {
    const pending = deferredResponse();
    getMock.mockResolvedValueOnce(response(kycResponse())).mockReturnValueOnce(pending.promise);
    const element = render();
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));

    expect(component.isLoading()).toBe(true);
    expect(element.querySelector('app-verify-status')).toBeNull();
    expect(element.querySelector('app-google-auth')).toBeNull();
    expect(element.textContent).not.toContain('Loading KYC data...');
    expect(element.querySelector('form')).toBeNull();
    await component.loadKyc();
    expect(getMock).toHaveBeenCalledTimes(2);

    pending.resolve(response(profile));
    await fixture.whenStable();
    expect(component.isLoading()).toBe(false);
    expect(element.querySelector('app-verify-status')).not.toBeNull();
    expect(element.querySelector('app-google-auth')).not.toBeNull();
    component.startVerification();
    await fixture.whenStable();
    expect(input('m_name')?.value).toBe('Test');
  });

  it('recovers from a failed KYC request using Retry', async () => {
    getMock.mockRejectedValueOnce(new Error('Connection failed.'));
    const element = await load();

    expect(component.errorMessage()).not.toBe('');
    expect(component.isLoading()).toBe(false);
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('app-verify-status')).toBeNull();
    expect(element.querySelector('app-google-auth')).toBeNull();
    expect(getMock).toHaveBeenCalledOnce();
    button('Retry')!.click();
    await fixture.whenStable();
    expect(component.errorMessage()).toBe('');
    expect(component.profileLoaded()).toBe(true);
    expect(element.querySelector('app-verify-status')).not.toBeNull();
    expect(element.querySelector('app-google-auth')).not.toBeNull();
    expect(getMock).toHaveBeenCalledTimes(3);
    component.startVerification();
    await fixture.whenStable();
    expect(input('m_name')?.value).toBe('Test');
  });

  it('does not load a profile when the backend rejects the KYC response', async () => {
    getMock.mockResolvedValueOnce(response({ result: false, message: 'KYC unavailable.' }));
    await load();

    expect(component.errorMessage()).toContain('KYC unavailable.');
    expect(getMock).toHaveBeenCalledOnce();
    expect(component.profileLoaded()).toBe(false);
    expect(imageInput()).toBeNull();
  });

  it('shows a profile error and retries the initial flow without advancing', async () => {
    getMock
      .mockResolvedValueOnce(response(kycResponse()))
      .mockResolvedValueOnce(response({ result: false, message: 'Profile unavailable.' }));
    await load();

    expect(component.errorMessage()).toBe('Profile unavailable.');
    expect(component.profileLoaded()).toBe(false);
    expect(input('m_name')).toBeNull();
    await component.onUpdateProfile();
    expect(putMock).not.toHaveBeenCalled();
    button('Retry')!.click();
    await fixture.whenStable();
    expect(component.profileLoaded()).toBe(true);
    component.startVerification();
    await fixture.whenStable();
    expect(input('m_name')?.value).toBe('Test');
    expect(component.step()).toBe('profile');
  });

  it('preserves a profile connection error and does not start OTP', async () => {
    getMock
      .mockResolvedValueOnce(response(kycResponse()))
      .mockRejectedValueOnce(new Error('Profile connection failed.'));
    await load();

    expect(component.errorMessage()).toBe('Profile connection failed.');
    expect(component.isLoading()).toBe(false);
    expect(postMock).not.toHaveBeenCalled();
    expect(imageInput()).toBeNull();
  });

  it.each([
    ['m_name', '   '],
    ['m_phone', 'abc'],
    ['m_birthdate', ''],
    ['m_birthdate', '1990-02-30'],
  ])('blocks invalid profile field %s with value %s', async (field, value) => {
    await load();
    component.profileForm.controls.member.get(field)!.setValue(value);
    await component.onUpdateProfile();
    await fixture.whenStable();

    expect(component.profileForm.invalid).toBe(true);
    expect(component.step()).toBe('profile');
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
    expect(imageInput()).toBeNull();
  });

  it('requires the sub-district before saving the complete address', async () => {
    await load();
    component.profileForm.controls.address.controls.address_district.setValue('');
    await component.onUpdateProfile();

    expect(putMock).not.toHaveBeenCalled();
    expect(component.step()).toBe('profile');
  });

  it('sends the selected birthdate as YYYY-MM-DD and skips OTP for a non-Thai phone code', async () => {
    useProfile({
      ...profile,
      data: { ...profile.data, member: { ...member, m_phone_code: '+1' } },
    });
    await load();
    expect(otpMethodSelect()).toBeNull();
    component.setOtpMethod('email');
    expect(component.otpMethod()).toBe('sms');
    const firstName = input('m_name')!;
    firstName.value = ' Updated ';
    firstName.dispatchEvent(new Event('input'));
    const birthdate = input('m_birthdate')!;
    birthdate.value = '1992-02-29';
    birthdate.dispatchEvent(new Event('input'));
    expect(component.profileForm.controls.member.controls.m_birthdate.value).toBe('1992-02-29');
    button('Next')!.click();
    await fixture.whenStable();

    expect(putMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/member/profile/update',
      {
        member: { ...formMember, m_name: 'Updated', m_birthdate: '1992-02-29' },
        address,
      },
      { validateStatus: expect.any(Function) },
    );
    expect(component.step()).toBe('id-proof');
    expect(imageInput()).not.toBeNull();
    expect(otpMethodSelect()).toBeNull();
    expect(input('otpCode')).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('keeps the profile draft after a rejected update and allows retrying', async () => {
    await load();
    component.profileForm.controls.member.controls.m_name.setValue('Changed');
    putMock.mockResolvedValueOnce(response({ result: false, message: 'Unable to save profile.' }));
    await component.onUpdateProfile();
    await fixture.whenStable();

    expect(component.step()).toBe('profile');
    expect(component.errorMessage()).toBe('Unable to save profile.');
    expect(input('m_name')?.value).toBe('Changed');
    expect(input('m_name')?.disabled).toBe(false);
    expect(imageInput()).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
    await component.onUpdateProfile();
    await fixture.whenStable();
    expect(putMock).toHaveBeenCalledTimes(2);
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
    expect(component.step()).toBe('otp');
  });

  it('automatically sends SMS after saving for +66 and waits for verification', async () => {
    await enterOtp();

    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
    expect(component.step()).toBe('otp');
    expect(component.otpSent()).toBe(true);
    expect(otpMethodSelect()?.value).toBe('sms');
    expect(input('otpCode')).not.toBeNull();
    expect(input('m_name')).toBeNull();
    expect(imageInput()).toBeNull();
  });

  it('selects email before saving and automatically sends only email OTP', async () => {
    await load();
    expect(otpMethodSelect()?.value).toBe('sms');
    selectOtpMethod('email');

    expect(component.otpMethod()).toBe('email');
    expect(postMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
    button('Next')!.click();
    await fixture.whenStable();

    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/email/send');
    expect(component.step()).toBe('otp');
    expect(otpMethodSelect()?.value).toBe('email');
    expect(component.otpSent()).toBe(true);
    expect(imageInput()).toBeNull();
  });

  it('verifies the emailed OTP with its nested reference, leading zeros and KYC purpose', async () => {
    await load();
    selectOtpMethod('email');
    button('Next')!.click();
    await fixture.whenStable();
    const otp = input('otpCode')!;
    otp.value = '001234';
    otp.dispatchEvent(new Event('input'));
    button('Verify')!.click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenNthCalledWith(1, '/v1/verify/email/send');
    expect(postMock).toHaveBeenNthCalledWith(2, '/v1/verify/email/verify', {
      memberRef: 'email-otp-reference',
      otpCode: '001234',
      optional: 'KYC',
    });
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(component.step()).toBe('id-proof');
    expect(imageInput()).not.toBeNull();
    expect(otpMethodSelect()).toBeNull();
  });

  it('invalidates a sent code when switching channels and waits for a new send', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    component.errorMessage.set('Previous OTP error.');
    selectOtpMethod('email');

    expect(component.otpSent()).toBe(false);
    expect(component.otpForm.controls.otpCode.value).toBe('');
    expect(component.errorMessage()).toBe('');
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
    component.otpForm.controls.otpCode.setValue('001234');
    await component.onVerifyOtp();
    expect(postMock).toHaveBeenCalledOnce();

    button('Please send it again.')!.click();
    await fixture.whenStable();
    component.otpForm.controls.otpCode.setValue('005678');
    await component.onVerifyOtp();
    await fixture.whenStable();

    expect(postMock).toHaveBeenNthCalledWith(2, '/v1/verify/email/send');
    expect(postMock).toHaveBeenNthCalledWith(3, '/v1/verify/email/verify', {
      memberRef: 'email-otp-reference',
      otpCode: '005678',
      optional: 'KYC',
    });
    expect(putMock).toHaveBeenCalledOnce();
    expect(component.step()).toBe('id-proof');
  });

  it('retries email delivery without saving the profile again', async () => {
    await load();
    selectOtpMethod('email');
    postMock.mockRejectedValueOnce(backendError('Internal error.', 'Email service unavailable.'));
    button('Next')!.click();
    await fixture.whenStable();

    expect(component.step()).toBe('otp');
    expect(component.errorMessage()).toBe('Email service unavailable.');
    expect(component.otpSent()).toBe(false);
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/email/send');
    button('Please send it again.')!.click();
    await fixture.whenStable();

    expect(component.errorMessage()).toBe('');
    expect(component.otpSent()).toBe(true);
    expect(postMock).toHaveBeenNthCalledWith(2, '/v1/verify/email/send');
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('preserves a sent OTP when the current or an unsupported method is selected', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    component.setOtpMethod('sms');
    component.setOtpMethod('totp');

    expect(component.otpMethod()).toBe('sms');
    expect(component.otpSent()).toBe(true);
    expect(component.otpForm.controls.otpCode.value).toBe('001234');
    expect(postMock).toHaveBeenCalledOnce();
    await component.onVerifyOtp();
    expect(postMock).toHaveBeenLastCalledWith('/v1/verify/sms/verify', {
      memberRef: 'nested-otp-reference',
      otpCode: '001234',
      optional: 'KYC',
    });
  });

  it('accepts a phone number starting with +66 and sends it unchanged', async () => {
    await load();
    const phone = input('m_phone')!;
    expect(phone.type).toBe('tel');
    phone.value = '+66812345678';
    phone.dispatchEvent(new Event('input'));
    button('Next')!.click();
    await fixture.whenStable();

    expect(putMock).toHaveBeenCalledExactlyOnceWith(
      '/v1/member/profile/update',
      {
        member: { ...formMember, m_phone: '+66812345678' },
        address,
      },
      { validateStatus: expect.any(Function) },
    );
    expect(component.step()).toBe('otp');
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
  });

  it('retries a failed SMS send without updating the profile again', async () => {
    postMock.mockRejectedValueOnce(backendError('Internal error.', 'SMS service unavailable.'));
    await enterOtp();

    expect(component.errorMessage()).toBe('SMS service unavailable.');
    expect(component.step()).toBe('otp');
    expect(component.otpSent()).toBe(false);
    expect(imageInput()).toBeNull();
    await component.onVerifyOtp();
    expect(postMock).toHaveBeenCalledOnce();
    await component.sendOtp();
    await fixture.whenStable();
    expect(component.errorMessage()).toBe('');
    expect(component.otpSent()).toBe(true);
    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { memberRef: 'top-level-reference', data: { memberRef: '' } },
    { memberRef: 'top-level-reference' },
  ])('rejects an SMS response without a nested member reference', async (data) => {
    postMock.mockResolvedValueOnce(response(data));
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    await component.onVerifyOtp();

    expect(component.otpSent()).toBe(false);
    expect(component.errorMessage()).not.toBe('');
    expect(component.step()).toBe('otp');
    expect(postMock).toHaveBeenCalledOnce();
    expect(imageInput()).toBeNull();
  });

  it.each(['', '12345', '1234567', 'abc123'])('does not verify invalid OTP %s', async (otpCode) => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue(otpCode);
    await component.onVerifyOtp();

    expect(postMock).toHaveBeenCalledOnce();
    expect(component.step()).toBe('otp');
    expect(imageInput()).toBeNull();
  });

  it.each(['incorrect', 'expired'])(
    'stays on the OTP step when the code is %s',
    async (failure) => {
      await enterOtp();
      const message = failure === 'expired' ? 'OTP has expired.' : 'OTP is incorrect.';
      if (failure === 'expired') postMock.mockRejectedValueOnce(backendError(message));
      else postMock.mockResolvedValueOnce(response({ result: false, message }));
      component.otpForm.controls.otpCode.setValue('001234');
      await component.onVerifyOtp();
      await fixture.whenStable();

      expect(component.errorMessage()).toBe(message);
      expect(component.step()).toBe('otp');
      expect(component.otpForm.controls.otpCode.value).toBe('001234');
      expect(input('otpCode')?.disabled).toBe(false);
      expect(imageInput()).toBeNull();
    },
  );

  it('forwards the reference, leading-zero OTP and KYC purpose before showing the image stage', async () => {
    await enterOtp();
    const otp = input('otpCode')!;
    otp.value = '001234';
    otp.dispatchEvent(new Event('input'));
    button('Verify')!.click();
    await fixture.whenStable();

    expect(postMock).toHaveBeenNthCalledWith(2, '/v1/verify/sms/verify', {
      memberRef: 'nested-otp-reference',
      otpCode: '001234',
      optional: 'KYC',
    });
    expect(component.step()).toBe('id-proof');
    expect(input('otpCode')).toBeNull();
    expect(imageInput()).not.toBeNull();
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('returns from OTP to the profile and invalidates the previous code', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    button('Back')!.click();
    await fixture.whenStable();

    expect(component.step()).toBe('profile');
    expect(component.otpSent()).toBe(false);
    expect(component.otpForm.controls.otpCode.value).toBe('');
    expect(input('m_name')?.value).toBe('Test');
    expect(postMock).toHaveBeenCalledOnce();
  });

  it('revisits an already verified OTP step without verifying the same code twice', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    await component.onVerifyOtp();
    await fixture.whenStable();
    expect(component.step()).toBe('id-proof');
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    button('Back')!.click();
    await fixture.whenStable();

    expect(component.step()).toBe('otp');
    expect(component.otpVerified()).toBe(true);
    button('Next')!.click();
    await fixture.whenStable();
    expect(component.step()).toBe('id-proof');
    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('returns from the document step to the profile when OTP was skipped', async () => {
    await enterImageStage();
    button('Back')!.click();
    await fixture.whenStable();

    expect(component.step()).toBe('profile');
    expect(input('m_name')?.value).toBe('Test');
    expect(input('otpCode')).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('supports six OTP boxes, full-code paste and keyboard navigation', async () => {
    await enterOtp();
    const digits = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('.otp-digit'),
    );
    expect(digits).toHaveLength(6);
    digits[0].value = '0';
    digits[0].dispatchEvent(new Event('input'));
    expect(document.activeElement).toBe(digits[1]);
    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '001234' } });
    digits[1].dispatchEvent(paste);
    await fixture.whenStable();

    expect(paste.defaultPrevented).toBe(true);
    expect(digits.map((digit) => digit.value)).toEqual(['0', '0', '1', '2', '3', '4']);
    expect(component.otpForm.controls.otpCode.value).toBe('001234');
    digits[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(digits[4]);
    digits[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(digits[5]);
    digits[5].value = '';
    digits[5].dispatchEvent(new Event('input'));
    digits[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(document.activeElement).toBe(digits[4]);
    expect(component.otpForm.controls.otpCode.value).toBe('0012');
    expect(postMock).toHaveBeenCalledOnce();
  });

  it('clears the old OTP and uses the new reference after resending', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    postMock.mockResolvedValueOnce(sentOtp('new-reference'));
    await component.sendOtp();
    await fixture.whenStable();

    expect(component.otpForm.controls.otpCode.value).toBe('');
    component.otpForm.controls.otpCode.setValue('005678');
    await component.onVerifyOtp();
    expect(postMock).toHaveBeenLastCalledWith('/v1/verify/sms/verify', {
      memberRef: 'new-reference',
      otpCode: '005678',
      optional: 'KYC',
    });
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('does not reuse the previous reference if a resend fails', async () => {
    await enterOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    postMock.mockRejectedValueOnce(backendError('Unable to resend.'));
    await component.sendOtp();
    component.otpForm.controls.otpCode.setValue('001234');
    await component.onVerifyOtp();

    expect(component.otpSent()).toBe(false);
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(component.step()).toBe('otp');
    expect(imageInput()).toBeNull();
  });

  it('blocks duplicate profile submissions and other actions while saving', async () => {
    await load();
    const pending = deferredResponse();
    putMock.mockReturnValueOnce(pending.promise);
    const save = component.onUpdateProfile();
    fixture.detectChanges();
    await component.onUpdateProfile();
    await component.sendOtp();
    await component.onVerifyOtp();
    component.setOtpMethod('email');
    component.closeVerification();
    component.onBack();

    expect(component.isSaving()).toBe(true);
    expect(component.isVerificationOpen()).toBe(true);
    expect(component.hasStarted()).toBe(true);
    expect(component.step()).toBe('profile');
    expect(component.otpMethod()).toBe('sms');
    expect(otpMethodSelect()?.disabled).toBe(true);
    expect(button('Saving...')?.disabled).toBe(true);
    expect(input('m_name')?.disabled).toBe(true);
    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).not.toHaveBeenCalled();
    pending.resolve(response({ result: true, message: 'Profile updated.' }));
    await save;
    await fixture.whenStable();
    expect(component.isBusy()).toBe(false);
    expect(postMock).toHaveBeenCalledOnce();
  });

  it('blocks duplicate sends and verification while resending an OTP', async () => {
    await enterOtp();
    const pending = deferredResponse();
    postMock.mockReturnValueOnce(pending.promise);
    const send = component.sendOtp();
    fixture.detectChanges();
    await component.sendOtp();
    await component.onVerifyOtp();
    await component.onUpdateProfile();
    component.setOtpMethod('email');

    expect(component.isSendingOtp()).toBe(true);
    expect(component.otpMethod()).toBe('sms');
    expect(otpMethodSelect()?.disabled).toBe(true);
    expect(button('Sending OTP...')?.disabled).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(putMock).toHaveBeenCalledOnce();
    pending.resolve(sentOtp('resent-reference'));
    await send;
    await fixture.whenStable();
    expect(component.isBusy()).toBe(false);
    expect(component.otpSent()).toBe(true);
  });

  it('blocks duplicate verification and resending until verification completes', async () => {
    await enterOtp();
    const pending = deferredResponse();
    postMock.mockReturnValueOnce(pending.promise);
    component.otpForm.controls.otpCode.setValue('001234');
    const verify = component.onVerifyOtp();
    fixture.detectChanges();
    await component.onVerifyOtp();
    await component.sendOtp();
    await component.onUpdateProfile();
    component.setOtpMethod('email');

    expect(component.isVerifyingOtp()).toBe(true);
    expect(component.otpMethod()).toBe('sms');
    expect(otpMethodSelect()?.disabled).toBe(true);
    expect(button('Verifying OTP...')?.disabled).toBe(true);
    expect(input('otpCode')?.disabled).toBe(true);
    expect(imageInput()).toBeNull();
    expect(postMock).toHaveBeenCalledTimes(2);
    pending.resolve(response({ result: true, message: 'OTP verified.' }));
    await verify;
    await fixture.whenStable();
    expect(component.step()).toBe('id-proof');
    expect(imageInput()).not.toBeNull();
  });

  it('ignores actions called before KYC and the profile have loaded', async () => {
    fixture = TestBed.createComponent(Verify);
    component = fixture.componentInstance;
    component.profileForm.setValue({ member: formMember, address });
    component.otpForm.controls.otpCode.setValue('001234');
    await component.onUpdateProfile();
    await component.sendOtp();
    await component.onVerifyOtp();

    expect(getMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('keeps image selection local without uploading or submitting KYC', async () => {
    useProfile({
      ...profile,
      data: { ...profile.data, member: { ...member, m_phone_code: '+1' } },
    });
    await load();
    await component.onUpdateProfile();
    await fixture.whenStable();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    const fileInput = imageInput()!;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(component.idImagePreview()).toMatch(/^data:image\/png;base64,/));

    expect(component.selectedIdFile()).toBe(file);
    component.removeIdImage();
    expect(component.selectedIdFile()).toBeNull();
    expect(component.idImagePreview()).toBe('');
    expect(putMock).toHaveBeenCalledOnce();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('accepts dropped images with the same validation as the file picker', async () => {
    await enterImageStage();
    const dropArea = fixture.nativeElement.querySelector('[role="button"]') as HTMLElement;
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });
    dropArea.dispatchEvent(drop);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));

    expect(drop.defaultPrevented).toBe(true);
    expect(component.selectedIdFile()).toBe(file);
    expect(postMock).not.toHaveBeenCalled();
    const invalidDrop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(invalidDrop, 'dataTransfer', {
      value: { files: [new File(['pdf'], 'id.pdf', { type: 'application/pdf' })] },
    });
    component.onIdImageDrop(invalidDrop as DragEvent);
    await fixture.whenStable();
    expect(component.selectedIdFile()).toBeNull();
    expect(component.errorMessage()).not.toBe('');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('opens the document picker from the drop area using Enter and Space', async () => {
    await enterImageStage();
    const dropArea = fixture.nativeElement.querySelector('[role="button"]') as HTMLElement;
    const openPicker = vi.spyOn(imageInput()!, 'click').mockImplementation(() => {});

    dropArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    dropArea.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(openPicker).toHaveBeenCalledTimes(2);
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'submits exactly the two multipart fields and refreshes KYC after navigation returns %s',
    async (navigationResult) => {
      await enterImageStage();
      const file = new File(['image-data'], 'id.png', { type: 'image/png' });
      const choices = fixture.nativeElement.querySelector('#kyc-id-type') as HTMLSelectElement;
      expect(Array.from(choices.options).map((option) => option.value)).toEqual([
        '',
        'National ID card',
        'Passport',
        'Driver License',
        'Bill',
      ]);
      selectIdType('Passport');
      selectImageFile(file);
      await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));
      navigateMock.mockResolvedValueOnce(navigationResult);
      getMock.mockResolvedValueOnce(response(kycResponse(0)));
      button('Next')!.click();
      await fixture.whenStable();

      expect(postMock).toHaveBeenCalledExactlyOnceWith(
        '/v1/verify/kyc/image',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Content-Type': null } }),
      );
      const body = postMock.mock.calls[0][1] as FormData;
      expect(Array.from(body.keys()).sort()).toEqual(['kycIdType', 'kycImage']);
      expect(body.get('kycImage')).toBe(file);
      expect(body.get('kycIdType')).toBe('Passport');
      expect(navigateMock).toHaveBeenCalledExactlyOnceWith('/user/verify', { replaceUrl: true });
      expect(getMock).toHaveBeenCalledTimes(3);
      expect(getMock).toHaveBeenLastCalledWith('/v1/verify/kyc');
      expect(component.kycDetail()?.data.kyc_stat).toBe(0);
      expect(component.selectedIdFile()).toBeNull();
      expect(component.idImagePreview()).toBe('');
      expect(component.isUploadingImage()).toBe(false);
      expect(imageInput()).toBeNull();
    },
  );

  it('requires a document type and image before submitting', async () => {
    await enterImageStage();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectImageFile(file);
    await component.onSubmitImage();

    expect(component.imageForm.invalid).toBe(true);
    expect(component.errorMessage()).not.toBe('');
    expect(postMock).not.toHaveBeenCalled();
    selectIdType('Passport');
    component.removeIdImage();
    await component.onSubmitImage();

    expect(component.errorMessage()).not.toBe('');
    expect(postMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(component.step()).toBe('id-proof');
  });

  it('refreshes accepted KYC without offering another upload when navigation fails', async () => {
    await enterImageStage();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    navigateMock.mockRejectedValueOnce(new Error('Navigation failed.'));
    getMock.mockResolvedValueOnce(response(kycResponse(0)));

    await component.onSubmitImage();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledExactlyOnceWith('/user/verify', { replaceUrl: true });
    expect(getMock).toHaveBeenCalledTimes(3);
    expect(getMock).toHaveBeenLastCalledWith('/v1/verify/kyc');
    expect(component.kycDetail()?.data.kyc_stat).toBe(0);
    expect(component.selectedIdFile()).toBeNull();
    expect(component.idImagePreview()).toBe('');
    expect(component.errorMessage()).toContain('KYC image submitted successfully');
    expect(component.errorMessage()).toContain('unable to open the verification page');
    expect(component.step()).not.toBe('id-proof');
    expect(imageInput()).toBeNull();
    expect(button('Next')).toBeUndefined();
    await component.onSubmitImage();
    expect(postMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['empty', () => new File([], 'empty.png', { type: 'image/png' })],
    ['unsupported', () => new File(['pdf-data'], 'id.pdf', { type: 'application/pdf' })],
    [
      'oversized',
      () => new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ],
  ] as const)('rejects an %s image without requesting an upload', async (_name, createFile) => {
    await enterImageStage();
    selectIdType('Passport');
    selectImageFile(createFile());

    expect(component.selectedIdFile()).toBeNull();
    expect(component.idImagePreview()).toBe('');
    expect(component.errorMessage()).not.toBe('');
    await component.onSubmitImage();
    expect(postMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('keeps the selected document after an upload failure and allows retrying', async () => {
    await enterImageStage();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));
    postMock.mockRejectedValueOnce(backendError('Document was rejected.'));
    await component.onSubmitImage();
    await fixture.whenStable();

    expect(component.step()).toBe('id-proof');
    expect(component.errorMessage()).toBe('Document was rejected.');
    expect(component.selectedIdFile()).toBe(file);
    expect(component.imageForm.controls.kycIdType.value).toBe('Passport');
    expect(component.imageForm.enabled).toBe(true);
    expect(component.idImagePreview()).not.toBe('');
    expect(navigateMock).not.toHaveBeenCalled();
    getMock.mockResolvedValueOnce(response(kycResponse(0)));
    await component.onSubmitImage();
    await fixture.whenStable();

    expect(postMock).toHaveBeenCalledTimes(2);
    expect((postMock.mock.calls[1][1] as FormData).get('kycImage')).toBe(file);
    expect(navigateMock).toHaveBeenCalledOnce();
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('blocks duplicate uploads and document changes until navigation completes', async () => {
    await enterImageStage();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    selectIdType('Passport');
    selectImageFile(file);
    await vi.waitFor(() => expect(component.idImagePreview()).not.toBe(''));
    const pending = deferredResponse();
    postMock.mockReturnValueOnce(pending.promise);
    let resolveNavigation!: (result: boolean) => void;
    navigateMock.mockReturnValueOnce(new Promise((resolve) => (resolveNavigation = resolve)));
    const upload = component.onSubmitImage();
    fixture.detectChanges();
    await component.onSubmitImage();
    component.removeIdImage();
    selectImageFile(new File(['other-image'], 'other.png', { type: 'image/png' }));

    expect(postMock).toHaveBeenCalledOnce();
    expect(component.selectedIdFile()).toBe(file);
    expect(component.isUploadingImage()).toBe(true);
    expect(button('Uploading...')?.disabled).toBe(true);
    expect(button('Change image')?.disabled).toBe(true);
    expect(button('Remove')?.disabled).toBe(true);
    expect(imageInput()?.disabled).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('#kyc-id-type') as HTMLSelectElement).disabled,
    ).toBe(true);
    pending.resolve(uploadedImage());
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledOnce());
    expect(component.isBusy()).toBe(true);
    await component.onSubmitImage();
    expect(postMock).toHaveBeenCalledOnce();
    getMock.mockResolvedValueOnce(response(kycResponse(0)));
    resolveNavigation(true);
    await upload;
    await fixture.whenStable();
    expect(component.isBusy()).toBe(false);
  });

  it('does not submit an image before the profile and OTP steps allow it', async () => {
    await load();
    const file = new File(['image-data'], 'id.png', { type: 'image/png' });
    component.selectedIdFile.set(file);
    component.imageForm.controls.kycIdType.setValue('Passport');
    await component.onSubmitImage();
    expect(postMock).not.toHaveBeenCalled();
    await component.onUpdateProfile();
    await component.onSubmitImage();

    expect(component.step()).toBe('otp');
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/sms/send');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
