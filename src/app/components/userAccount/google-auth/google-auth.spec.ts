import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { api, ApiError, type ApiResponse } from '../../../../shared/api/api';
import { clearAuthSession, setAuthSession, type AuthSession } from '../../../../shared/guard/auth';
import { GoogleAuth } from './google-auth';

@Component({ selector: 'qrcode', template: '' })
class QrCodeStub {
  readonly qrdata = input('');
  readonly width = input(224);
  readonly margin = input(4);
  readonly errorCorrectionLevel = input('M');
}

describe('GoogleAuth', () => {
  let component: GoogleAuth;
  let fixture: ComponentFixture<GoogleAuth>;
  const setupData = {
    result: true,
    message: 'Setup ready.',
    data: {
      secret: 'test-secret',
      qrCodeUrl: 'otpauth://totp/POX:test?secret=TEST',
      backupCodes: ['backup-1', 'backup-2'],
    },
  };
  const postMock = vi.fn<typeof api.post>();

  function response(data: unknown): ApiResponse {
    return { data, status: 200 } as ApiResponse;
  }

  function button(text: string): HTMLButtonElement {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((element) => element.textContent?.trim() === text)!;
  }

  function inputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input[inputmode="numeric"]'));
  }

  function enterToken(token: string): void {
    const input = inputs()[0];
    input.value = token;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function setup(): Promise<void> {
    component.openVerification();
    await component.enableGoogleAuth();
    await fixture.whenStable();
  }

  async function enterVerify(): Promise<void> {
    await setup();
    button('Next').click();
    await fixture.whenStable();
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
    clearAuthSession();
    setAuthSession({
      require2FA: false,
      member: {} as AuthSession['member'],
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });
    postMock.mockReset().mockImplementation(async (url) => {
      if (url === '/v1/verify/totp/setup') return response(setupData);
      if (url === '/v1/verify/totp/verify-setup') {
        return response({ result: true, message: 'Enabled.' });
      }
      throw new Error(`Unexpected POST: ${url}`);
    });
    vi.spyOn(api, 'post').mockImplementation(postMock);
    await TestBed.configureTestingModule({
      imports: [GoogleAuth],
      providers: [provideRouter([])],
    })
      .overrideComponent(GoogleAuth, {
        remove: { imports: [QRCodeComponent] },
        add: { imports: [QrCodeStub] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(GoogleAuth);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthSession();
  });

  it('opens preparation from the card without requesting setup until Start Verify', async () => {
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    button('Verify').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Things you need to prepare');
    expect(postMock).not.toHaveBeenCalled();
    button('Start Verify').click();
    await fixture.whenStable();
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/v1/verify/totp/setup');
    expect(fixture.nativeElement.querySelector('qrcode')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#google-auth-link').value).toBe(
      setupData.data.qrCodeUrl,
    );
    expect(
      fixture.nativeElement.querySelector('[aria-label="Backup codes"]').textContent,
    ).toContain('backup-1');
    expect(fixture.nativeElement.textContent).not.toContain(setupData.data.secret);
    expect(inputs()).toHaveLength(0);
    button('Next').click();
    await fixture.whenStable();
    expect(inputs()).toHaveLength(6);
    expect(document.activeElement).toBe(inputs()[0]);
    expect(fixture.nativeElement.querySelector('qrcode')).toBeNull();
  });

  it('shows Already Verify and prevents setup when require2fa is true', async () => {
    fixture.componentRef.setInput('require2fa', true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('article').textContent).toContain('Already Verify');
    expect(button('Verify')).toBeUndefined();
    component.openVerification();
    await component.enableGoogleAuth();
    expect(component.isOpen()).toBe(false);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate setup and closing while pending', async () => {
    let resolve!: (value: ApiResponse) => void;
    postMock.mockReturnValueOnce(new Promise((complete) => (resolve = complete)));
    component.openVerification();
    const pending = component.enableGoogleAuth();
    fixture.detectChanges();
    expect(button('Setting up...').disabled).toBe(true);
    component.closeVerification();
    component.onBack();
    await component.enableGoogleAuth();
    expect(component.isOpen()).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(1);
    resolve(response(setupData));
    await pending;
  });

  it.each(['backend', 'network'])(
    'keeps preparation and allows retry on a %s setup error',
    async (kind) => {
      if (kind === 'backend')
        postMock.mockResolvedValueOnce(response({ result: false, message: 'Setup failed.' }));
      else postMock.mockRejectedValueOnce(new ApiError('Network Error'));
      await setup();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toMatch(
        /Setup failed|Unable to setup/,
      );
      expect(component.step()).toBe('preparation');
      expect(component.backupCodes()).toEqual([]);
      button('Start Verify').click();
      await fixture.whenStable();
      expect(component.step()).toBe('setup');
    },
  );

  it('preserves the same QR and backup codes through Back, close and reopen', async () => {
    await enterVerify();
    enterToken('0123');
    button('Back').click();
    await fixture.whenStable();
    expect(component.step()).toBe('setup');
    expect(component.verifyToken()).toBe('');
    button('Back').click();
    await fixture.whenStable();
    button('Start Verify').click();
    await fixture.whenStable();
    component.closeVerification();
    await fixture.whenStable();
    button('Verify').click();
    await fixture.whenStable();
    expect(component.step()).toBe('setup');
    expect(component.qrPath()).toBe(setupData.data.qrCodeUrl);
    expect(component.backupCodes()).toEqual(setupData.data.backupCodes);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('handles Escape and closes the dialog', async () => {
    component.openVerification();
    await fixture.whenStable();
    fixture.nativeElement
      .querySelector('dialog')
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it.each(['', '12345', '12a456', '１２３４５６'])(
    'does not verify an incomplete token: %j',
    async (token) => {
      await enterVerify();
      enterToken(token);
      await component.verifySetup();
      expect(button('Verify & Complete Setup').disabled).toBe(true);
      expect(postMock).toHaveBeenCalledTimes(1);
    },
  );

  it('submits only on confirmation, preserves leading zeros, and completes setup', async () => {
    const changed = vi.fn();
    component.require2fa.subscribe(changed);
    await enterVerify();
    enterToken('012345');
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(button('Verify & Complete Setup').disabled).toBe(false);
    button('Verify & Complete Setup').click();
    await fixture.whenStable();
    expect(postMock).toHaveBeenLastCalledWith('/v1/verify/totp/verify-setup', { token: '012345' });
    expect(changed).toHaveBeenCalledWith(true);
    expect(component.isEnabled()).toBe(true);
    expect(component.step()).toBe('complete');
    expect(fixture.nativeElement.textContent).toContain('Setup Complete!');
    expect(fixture.nativeElement.querySelector('article').textContent).toContain('Already Verify');
    expect(inputs()).toHaveLength(0);
    expect(component.qrPath()).toBe('');
    expect(component.backupCodes()).toEqual([]);
    expect(component.verifyToken()).toBe('');
    await component.enableGoogleAuth();
    await component.verifySetup();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('supports pasted codes, auto-advance, arrows and Backspace', async () => {
    await enterVerify();
    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '001234' } });
    inputs()[0].dispatchEvent(paste);
    await fixture.whenStable();
    expect(component.verifyToken()).toBe('001234');
    expect(document.activeElement).toBe(inputs()[5]);
    inputs()[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(inputs()[4]);
    inputs()[4].value = '';
    inputs()[4].dispatchEvent(new Event('input'));
    inputs()[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await fixture.whenStable();
    expect(component.otpDigits()).toEqual(['0', '0', '1', '', '', '4']);
    expect(document.activeElement).toBe(inputs()[3]);
  });

  it('blocks duplicate verification and navigation while verifying', async () => {
    await enterVerify();
    let resolve!: (value: ApiResponse) => void;
    postMock.mockReturnValueOnce(new Promise((complete) => (resolve = complete)));
    enterToken('001234');
    const pending = component.verifySetup();
    fixture.detectChanges();
    expect(inputs().every((input) => input.disabled)).toBe(true);
    component.onBack();
    component.closeVerification();
    await component.verifySetup();
    expect(component.step()).toBe('verify');
    expect(component.isOpen()).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(2);
    resolve(response({ result: true, message: 'Enabled.' }));
    await pending;
  });

  it.each(['backend', 'network'])(
    'preserves setup after a %s verification error and allows retry',
    async (kind) => {
      await enterVerify();
      if (kind === 'backend')
        postMock.mockResolvedValueOnce(response({ result: false, message: 'Invalid code.' }));
      else postMock.mockRejectedValueOnce(new ApiError('Network Error'));
      enterToken('012345');
      button('Verify & Complete Setup').click();
      await fixture.whenStable();
      expect(component.isEnabled()).toBe(false);
      expect(component.errorMessage()).toMatch(/Invalid code|Unable to verify/);
      expect(component.qrPath()).toBe(setupData.data.qrCodeUrl);
      expect(component.backupCodes()).toEqual(setupData.data.backupCodes);
      expect(inputs()[0].disabled).toBe(false);
      button('Verify & Complete Setup').click();
      await fixture.whenStable();
      expect(component.isEnabled()).toBe(true);
      expect(postMock).toHaveBeenCalledTimes(3);
    },
  );

  it('copies the actual setup URI and handles clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    try {
      await setup();
      await component.copyLink();
      expect(writeText).toHaveBeenCalledWith(setupData.data.qrCodeUrl);
      expect(component.copyMessage()).toBe('Link copied.');
      writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
      await component.copyLink();
      expect(component.copyMessage()).toContain('Please select and copy');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('downloads the returned backup codes as a text file', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:backup-codes');
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await setup();
    button('Download backup codes').click();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const reader = new FileReader();
    const contents = new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
    });
    reader.readAsText(blob);
    expect(await contents).toBe('backup-1\nbackup-2');
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('backup-codes.txt');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup-codes');
  });
});
