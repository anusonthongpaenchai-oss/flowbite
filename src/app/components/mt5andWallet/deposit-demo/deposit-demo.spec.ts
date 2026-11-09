import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DepositDemo } from './deposit-demo';

describe('DepositDemo', () => {
  it('shows the account type label when the wallet uses wallet_account_type', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    await TestBed.configureTestingModule({
      imports: [DepositDemo],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(DepositDemo);
    fixture.componentRef.setInput('account', {
      wallet_account_name: 'MT5-793315',
      wallet_account_no: '793315',
      wallet_account_type: 3,
      wallet_trading_type: 'demo',
    });
    await fixture.whenStable();

    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect(inputs[2].value).toBe('Demo Forex');
  });
});
