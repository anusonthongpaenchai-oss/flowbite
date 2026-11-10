import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainWalletCard } from './main-wallet-card';

describe('MainWalletCard', () => {
  let fixture: ComponentFixture<MainWalletCard>;

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
      imports: [MainWalletCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainWalletCard);
    fixture.componentRef.setInput('balanceLabel', '$0');
    await fixture.whenStable();
  });

  it('displays a zero balance and closes when the user presses Escape', () => {
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog');

    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('$0');
    dialog!.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(dialog!.open).toBe(false);
  });
});
