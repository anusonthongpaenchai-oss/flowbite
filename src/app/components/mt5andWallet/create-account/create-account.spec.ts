import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { api, type ApiResponse } from '@shared/api/api';
import { CreateAccount } from './create-account';

describe('CreateAccount', () => {
  let fixture: ComponentFixture<CreateAccount>;

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
      imports: [CreateAccount],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateAccount);
    fixture.componentRef.setInput('type', 'demo');
    await fixture.whenStable();
  });

  it('closes without submitting when the user cancels', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    const cancel = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cancel',
    )!;

    cancel.click();

    expect(dialog.open).toBe(false);
    expect(closed).toHaveBeenCalledOnce();
  });

  it('clears the selected leverage on account type changes and ignores older responses', async () => {
    const response = (leverages: number[]) =>
      ({
        data: { result: true, data: { leverages } },
      }) as ApiResponse;
    let resolveOldRequest!: (value: ApiResponse) => void;
    const oldRequest = new Promise<ApiResponse>((resolve) => (resolveOldRequest = resolve));
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([50, 500]));
    get.mockResolvedValueOnce(response([500, 2000])).mockReturnValueOnce(oldRequest);

    try {
      const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
      const accountType = dialog.querySelector<HTMLSelectElement>(
        '[formControlName="accountType"]',
      )!;
      const leverage = dialog.querySelector<HTMLSelectElement>('[formControlName="leverage"]')!;
      const selectOption = (select: HTMLSelectElement, index: number) => {
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };

      selectOption(accountType, 4);
      await vi.waitFor(() => expect(leverage.options[2]?.text).toBe('1:2000'));
      selectOption(leverage, 2);
      selectOption(accountType, 1);
      selectOption(accountType, 2);
      await vi.waitFor(() => expect(leverage.options[1]?.text).toBe('1:50'));
      expect(leverage.selectedIndex).toBe(0);

      resolveOldRequest(response([1000]));
      await oldRequest;
      await fixture.whenStable();
      expect([...leverage.options].slice(1).map((option) => option.text)).toEqual([
        '1:50',
        '1:500',
      ]);
      expect(leverage.selectedIndex).toBe(0);
    } finally {
      get.mockRestore();
    }
  });
});
