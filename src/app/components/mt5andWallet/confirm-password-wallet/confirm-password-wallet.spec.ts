import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmPasswordWallet } from './confirm-password-wallet';

describe('ConfirmPasswordWallet', () => {
  let component: ConfirmPasswordWallet;
  let fixture: ComponentFixture<ConfirmPasswordWallet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmPasswordWallet],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmPasswordWallet);
    fixture.componentRef.setInput('challenge', {
      method: 'sms',
      memberRef: 'otp-reference',
      expiresAt: Date.now() + 300_000,
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lets the server verify the entered code after the local countdown ends', async () => {
    fixture.componentRef.setInput('challenge', {
      method: 'sms',
      memberRef: 'otp-reference',
      expiresAt: 0,
    });
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
    const verify = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const verified = vi.fn();
    component.verified.subscribe(verified);

    expect(input.disabled).toBe(false);
    expect(verify.disabled).toBe(true);

    input.value = '012345';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    expect(verify.disabled).toBe(false);
    verify.click();
    expect(verified).toHaveBeenCalledExactlyOnceWith('012345');
  });
});
