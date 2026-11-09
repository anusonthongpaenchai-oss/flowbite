import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AxiosResponse } from 'axios';
import { api } from '@shared/api/api';
import { clearAuthSession, setAuthSession } from '@shared/guard/auth';
import { CardWallet } from '../card-wallet/card-wallet';

describe('ChangeLeverage from CardWallet', () => {
  const wallet = {
    wallet_account_name: 'MT5-000497921',
    wallet_account_no: '000497921',
    wall_account_type: '3',
    wallet_type: 'trading',
    wallet_leverage: 100,
  };
  let fixture: ComponentFixture<CardWallet>;
  const optionsPath = '/v1/trading/wallet-type/3/leverages';
  const get = vi.fn<typeof api.get>();
  const patch = vi.fn<typeof api.patch>();

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
      member: {
        id: 1,
        username: 'member',
        m_name: 'Test',
        m_lastname: 'Member',
        email: 'member@example.com',
        m_image_url: '',
      },
      accessToken: 'access',
      refreshToken: 'refresh',
      sessionUid: 'session',
      expiresIn: 3600,
    });
    get.mockReset().mockImplementation(async (url) => {
      if (url === '/v1/wallet/user/000497921') {
        return { data: { result: true, data: { wallet } } } as AxiosResponse;
      }
      if (url === optionsPath) {
        return { data: { result: true, data: { leverages: [50, 100, 200] } } } as AxiosResponse;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.spyOn(api, 'get').mockImplementation(get);
    vi.spyOn(api, 'patch').mockImplementation(patch.mockReset());

    await TestBed.configureTestingModule({
      imports: [CardWallet],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CardWallet);
    fixture.componentRef.setInput('accountNumber', wallet.wallet_account_no);
    await fixture.whenStable();
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  async function openChangeLeverage() {
    const card = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const edit = await vi.waitFor(() => {
      const button = card.querySelector<HTMLButtonElement>('button[aria-label="Edit leverage"]');
      expect(button).not.toBeNull();
      return button!;
    });
    expect(edit.disabled).toBe(false);
    edit.click();
    await fixture.whenStable();
    const dialog = card.querySelector<HTMLDialogElement>('app-change-leverage dialog')!;
    expect(dialog.open).toBe(true);
    const select = dialog.querySelector('select')!;
    const button = (label: string) =>
      [...dialog.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!;
    const selectLeverage = async () => {
      select.value = '200';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
    };
    return { card, dialog, select, button, selectLeverage };
  }

  it('loads choices for the wallet type and applies the chosen leverage only on confirmation', async () => {
    patch.mockResolvedValue({
      data: { result: true, data: { wallet: { ...wallet, wallet_leverage: 200 } } },
    } as AxiosResponse);
    const { card, dialog, select, button, selectLeverage } = await openChangeLeverage();
    const fields = [...dialog.querySelectorAll('input')];
    expect(fields.map(({ value }) => value)).toEqual([
      'MT5-000497921',
      '000497921',
      'Demo Forex',
      '100',
    ]);
    expect(fields.every(({ disabled }) => disabled)).toBe(true);
    expect(get).toHaveBeenCalledWith(optionsPath, expect.anything());
    expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
      'Select New Leverage',
      '1:50',
      '1:100',
      '1:200',
    ]);
    expect(button('Confirm').disabled).toBe(true);

    await selectLeverage();
    expect(patch).not.toHaveBeenCalled();
    button('Confirm').click();
    await fixture.whenStable();

    expect(patch).toHaveBeenCalledExactlyOnceWith(
      '/wallet/000497921/change-leverage',
      { leverage: 200 },
      expect.anything(),
    );
    expect(card.querySelector('app-change-leverage')).toBeNull();
    expect(card.open).toBe(true);
    expect(card.textContent).toContain('1:200');
  });

  it.each(['Cancel', 'Close change leverage'])('returns to the wallet on %s', async (action) => {
    const { card, button, selectLeverage } = await openChangeLeverage();
    await selectLeverage();
    button(action).click();
    await fixture.whenStable();

    expect(card.querySelector('app-change-leverage')).toBeNull();
    expect(card.open).toBe(true);
    expect(card.textContent).toContain('1:100');
    expect(patch).not.toHaveBeenCalled();
  });

  it('keeps the selected leverage when the server rejects the change', async () => {
    patch.mockResolvedValue({
      data: { result: false, message: 'Leverage change rejected.' },
    } as AxiosResponse);
    const { card, dialog, select, button, selectLeverage } = await openChangeLeverage();
    await selectLeverage();
    button('Confirm').click();
    await fixture.whenStable();

    expect(dialog.open).toBe(true);
    expect(select.value).toBe('200');
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      'Leverage change rejected.',
    );
    expect(button('Confirm').disabled).toBe(false);
    expect(card.textContent).toContain('1:100');
  });
});
