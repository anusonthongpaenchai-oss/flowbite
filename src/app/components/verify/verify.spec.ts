import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Verify } from './verify';

describe('Verify status card', () => {
  let component: Verify;
  let fixture: ComponentFixture<Verify>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Verify],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Verify);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it.each([
    ['None', 'KYC Verification', 'Verify'],
    ['pending', 'KYC Pending', null],
    ['approve', 'KYC Approved', null],
    ['reject', 'KYC Rejected', 'Try again'],
  ] as const)('shows the %s status and its available action', async (variant, status, action) => {
    fixture.componentRef.setInput('variant', variant);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h3')?.textContent?.trim()).toBe(status);
    expect(element.querySelector('button')?.textContent?.trim() ?? null).toBe(action);
    if (variant !== 'pending') {
      expect(element.querySelector('img')?.getAttribute('src')).toBe('svg/kyc/shield-check.svg');
    }
  });

  it.each(['None', 'reject'] as const)(
    'requests verification from the %s action',
    async (variant) => {
      fixture.componentRef.setInput('variant', variant);
      await fixture.whenStable();
      const requested = vi.spyOn(component.verifyRequested, 'emit');

      fixture.nativeElement.querySelector('button').click();

      expect(requested).toHaveBeenCalledOnce();
    },
  );

  it('shows the supplied reason only for a rejected verification', async () => {
    fixture.componentRef.setInput('reason', 'The document image is unclear.');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('The document image is unclear.');

    fixture.componentRef.setInput('variant', 'reject');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('The document image is unclear.');
  });

  it('disables the action and guards direct requests while busy', async () => {
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    const requested = vi.spyOn(component.verifyRequested, 'emit');
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    button.click();
    component.requestVerification();

    expect(requested).not.toHaveBeenCalled();
  });
});
