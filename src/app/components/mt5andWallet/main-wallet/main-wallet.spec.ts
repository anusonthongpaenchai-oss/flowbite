import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainWallet } from './main-wallet';

describe('MainWallet', () => {
  let fixture: ComponentFixture<MainWallet>;

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
    await TestBed.configureTestingModule({
      imports: [MainWallet],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainWallet);
    fixture.componentRef.setInput('balance', 3000);
    await fixture.whenStable();
  });

  it.each(['card', 'Main Wallet', 'Deposit', 'Withdraw'])(
    'opens details from %s',
    async (trigger) => {
      const page: HTMLElement = fixture.nativeElement;
      const target =
        trigger === 'card'
          ? page.querySelector('article')
          : [...page.querySelectorAll('button')].find(
              (button) => button.textContent?.trim() === trigger,
            );
      expect(target).toBeTruthy();
      target?.click();
      await fixture.whenStable();

      const dialog = page.querySelector('dialog');
      expect(dialog?.open).toBe(true);
      expect(dialog?.textContent).toContain('$3,000');
      expect(
        [...dialog!.querySelectorAll('button:disabled')].map((button) =>
          button.textContent?.trim(),
        ),
      ).toEqual(['Deposit', 'Withdraw', 'Transaction']);

      dialog!.querySelector<HTMLButtonElement>('[aria-label="Close Main Wallet"]')!.click();
      await fixture.whenStable();
      expect(page.querySelector('dialog')).toBeNull();
    },
  );
});
