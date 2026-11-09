import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { api } from '@shared/api/api';
import { clearAuthSession, getAuthSession, setAuthSession } from '@shared/guard/auth';
import { AxiosError, type AxiosResponse } from 'axios';
import { CardWallet } from '../card-wallet/card-wallet';

describe('Changing a password from CardWallet', () => {
  const wallet = {
    wallet_account_name: 'MT5-000735861',
    wallet_account_no: '000735861',
    wallet_type: 'trading',
    wallet_master_password: 'OldMaster1!',
    wallet_investor_password: 'OldInvestor1!',
  };

  let fixture: ComponentFixture<CardWallet>;
  let card: HTMLElement;
  const post = vi.fn<typeof api.post>();

  beforeEach(async () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    setAuthSession({
      require2FA: false,
      member: { id: 1, username: 'member', email: 'member@example.com' },
      accessToken: 'access',
      refreshToken: 'refresh',
      sessionUid: 'session',
      expiresIn: 3600,
    });
    vi.spyOn(api, 'get').mockResolvedValue({ data: { result: true, data: { wallet } } });
    vi.spyOn(api, 'post').mockImplementation(post.mockReset());

    await TestBed.configureTestingModule({
      imports: [CardWallet],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CardWallet);
    fixture.componentRef.setInput('accountNumber', wallet.wallet_account_no);
    card = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthSession();
  });

  async function openEditor(label: string) {
    const edit = await vi.waitFor(() => {
      const button = card.querySelector<HTMLButtonElement>(
        `button[aria-label="Edit ${label} password"]`,
      );
      expect(button).not.toBeNull();
      return button!;
    });
    expect(edit.disabled).toBe(false);
    edit.click();
    await fixture.whenStable();
    return card.querySelector<HTMLDialogElement>('app-change-password-wallet dialog')!;
  }

  function button(dialog: HTMLDialogElement, label: string) {
    return Array.from(dialog.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    )!;
  }

  function enter(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('requires a special character before requesting OTP', async () => {
    const dialog = await openEditor('master');
    const input = dialog.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')!;
    const select = dialog.querySelector('select')!;
    select.value = 'sms';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    enter(input, 'NewPassword1 ');
    await fixture.whenStable();
    expect(button(dialog, 'Confirm').disabled).toBe(true);
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(post).not.toHaveBeenCalled();

    enter(input, 'NewPassword1@');
    await fixture.whenStable();
    expect(button(dialog, 'Confirm').disabled).toBe(false);
  });

  it.each([
    { method: 'sms', status: 429 },
    { method: 'email', status: 200 },
  ])(
    'shows the top-level OTP error message for $method (HTTP $status)',
    async ({ method, status }) => {
      const message = 'OTP already sent. Please wait 1 minute before requesting again.';
      const response = {
        status,
        data: {
          result: false,
          message,
          error: { code: 'AUTH_ERROR', message: 'Unauthorized invalid or missing token' },
        },
      } as AxiosResponse;
      if (status === 200) {
        post.mockResolvedValueOnce(response);
      } else {
        post.mockRejectedValueOnce(
          new AxiosError(
            'Request failed',
            AxiosError.ERR_BAD_REQUEST,
            undefined,
            undefined,
            response,
          ),
        );
      }

      const dialog = await openEditor('master');
      enter(dialog.querySelector('input[autocomplete="new-password"]')!, 'NewPassword1@');
      const select = dialog.querySelector('select')!;
      select.value = method;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();

      button(dialog, 'Confirm').click();
      await fixture.whenStable();

      expect(dialog.querySelector('[role="alert"]')?.textContent?.trim()).toBe(message);
    },
  );

  it.each([
    { method: 'email', field: 'email', source: 'profile', destination: 'an-example@example.com' },
    { method: 'sms', field: 'm_phone', source: 'session', destination: '+1 202-555-0147' },
    { method: 'sms', field: 'm_phone', source: 'profile', destination: '+1 202-555-0148' },
  ])(
    'shows the $method destination as received from the $source',
    async ({ method, field, source, destination }) => {
      const session = getAuthSession()!;
      const member = { ...session.member, [field]: source === 'session' ? destination : '' };
      setAuthSession({ ...session, member });
      const dialog = await openEditor('master');
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { result: true, data: { member: { id: 1, [field]: destination } } },
      });
      post.mockResolvedValueOnce({ data: { data: { memberRef: 'otp-reference' } } });

      enter(dialog.querySelector('input[autocomplete="new-password"]')!, 'NewPassword1@');
      const select = dialog.querySelector('select')!;
      select.value = method;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
      button(dialog, 'Confirm').click();
      await fixture.whenStable();

      expect(dialog.querySelector('#wallet-password-otp-help strong')?.textContent).toBe(
        destination,
      );
      const profileRequests = vi
        .mocked(api.get)
        .mock.calls.filter(([url]) => url === '/v1/member/profile');
      expect(profileRequests).toHaveLength(source === 'profile' ? 1 : 0);
    },
  );

  it.each([
    { expiry: { expiresAt: 90 }, start: '1:30', next: '1:29' },
    { expiry: { expiresAt: 90, expiresIn: 75 }, start: '1:15', next: '1:14' },
    { expiry: { expiresAt: 1_800_000_060 }, start: '1:00', next: '0:59' },
    { expiry: {}, start: '5:00', next: '4:59' },
  ])('counts down from $start using the OTP response', async ({ expiry, start, next }) => {
    post.mockResolvedValueOnce({ data: { data: { memberRef: 'otp-reference', ...expiry } } });
    const dialog = await openEditor('master');
    enter(dialog.querySelector('input[autocomplete="new-password"]')!, 'NewPassword1@');
    const select = dialog.querySelector('select')!;
    select.value = 'email';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      vi.setSystemTime(1_800_000_000_000);
      button(dialog, 'Confirm').click();
      await fixture.whenStable();
      expect(dialog.querySelector('#wallet-password-otp-help strong')?.textContent).toBe(
        'member@example.com',
      );
      expect(dialog.textContent).toMatch(new RegExp(`OTP will expire in\\s+${start}`));

      vi.advanceTimersByTime(1_000);
      await fixture.whenStable();
      expect(dialog.textContent).toMatch(new RegExp(`OTP will expire in\\s+${next}`));
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('uses the Authenticator code as the password change token', async () => {
    post.mockResolvedValueOnce({ data: { result: true } });
    const dialog = await openEditor('master');
    enter(dialog.querySelector('input[autocomplete="new-password"]')!, 'NewPassword1@');
    const select = dialog.querySelector('select')!;
    expect(select.querySelector('option[value="totp"]')?.textContent?.trim()).toBe('Authenticator');
    select.value = 'totp';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    button(dialog, 'Confirm').click();
    await fixture.whenStable();
    expect(post).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('authenticator app');
    expect(dialog.textContent).not.toContain('Ref No.');
    expect(dialog.textContent).not.toContain('OTP will expire in');

    const code = dialog.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
    enter(code, '01234');
    await fixture.whenStable();
    expect(button(dialog, 'Verify Now').disabled).toBe(true);

    enter(code, '012345');
    await fixture.whenStable();
    button(dialog, 'Verify Now').click();
    await fixture.whenStable();

    expect(post).toHaveBeenCalledExactlyOnceWith('/v1/wallet/user/000735861/password/change', {
      type: 'main',
      password: 'NewPassword1@',
      otpMethod: 'totp',
      token: '012345',
    });
    expect(card.querySelector('app-change-password-wallet')).toBeNull();
  });

  it.each([
    ['master', 'main', 'sms', 'Master'],
    ['investor', 'investor', 'email', 'Investor'],
  ])(
    'updates the %s password after verifying the chosen OTP channel',
    async (label, type, method, title) => {
      post
        .mockResolvedValueOnce({
          data: {
            memberRef: 'unused-top-level-reference',
            data: {
              memberRef: 'otp-reference',
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            },
          },
        })
        .mockResolvedValueOnce({ data: { result: false, message: 'Invalid OTP.' } })
        .mockResolvedValueOnce({ data: { result: true } });

      const dialog = await openEditor(label);
      expect(dialog.open).toBe(true);
      expect(dialog.querySelector('h2')?.textContent).toContain(`Change ${title} Password`);
      expect(
        Array.from(
          dialog.querySelectorAll('input:disabled'),
          (input) => (input as HTMLInputElement).value,
        ),
      ).toEqual(['MT5-000735861', '000735861', 'trading']);
      expect(button(dialog, 'Confirm').disabled).toBe(true);

      enter(dialog.querySelector('input[autocomplete="new-password"]')!, 'NewPassword1!');
      const select = dialog.querySelector('select')!;
      select.value = method;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
      expect(post).not.toHaveBeenCalled();

      button(dialog, 'Confirm').click();
      await fixture.whenStable();
      expect(post).toHaveBeenCalledExactlyOnceWith(`/v1/verify/${method}/send`);
      expect(dialog.textContent).toContain('otp-reference');
      const otp = dialog.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
      expect(button(dialog, 'Verify Now').disabled).toBe(true);

      enter(otp, '012345');
      await fixture.whenStable();
      button(dialog, 'Verify Now').click();
      await fixture.whenStable();
      expect(post).toHaveBeenNthCalledWith(2, '/v1/wallet/user/000735861/password/change', {
        type,
        password: 'NewPassword1!',
        otpMethod: method,
        memberRef: 'otp-reference',
        otpCode: '012345',
      });
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Invalid OTP.');

      enter(otp, '067890');
      await fixture.whenStable();
      button(dialog, 'Verify Now').click();
      await fixture.whenStable();
      expect(card.querySelector('app-change-password-wallet')).toBeNull();
      card.querySelector<HTMLButtonElement>(`button[aria-label="Show ${label} password"]`)!.click();
      await fixture.whenStable();
      expect(card.textContent).toContain('NewPassword1!');
    },
  );
});
