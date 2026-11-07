import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '@components/ui/button/button';
import { InputComponent } from '@components/ui/input/input';
import { Checkbox } from '@components/ui/checkbox/checkbox';
import {
  createWallet,
  type CreateWalletRequest,
  WalletCreationUnconfirmedError,
} from '@shared/api/wallet/createWallet';
import { getWalletLeverages } from '@shared/api/wallet/getWalletLeverages';

export type WalletMode = CreateWalletRequest['wallet_trading_type'];
type WalletAccountType = CreateWalletRequest['wallet_account_type'];

@Component({
  imports: [Button, InputComponent, Checkbox, ReactiveFormsModule],
  selector: 'app-create-account',
  styleUrl: './create-account.css',
  templateUrl: './create-account.html',
})
export class CreateAccount implements AfterViewInit, OnDestroy {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly destroyRef = inject(DestroyRef);
  private leverageRequest?: AbortController;

  readonly type = input.required<WalletMode>();
  readonly closed = output<boolean>();
  readonly created = output<void>();

  protected readonly leverageOptions = signal<readonly number[] | null>(null);
  protected readonly leverageLoadFailed = signal(false);
  protected readonly accountTypes = [
    { id: 1, label: 'Real' },
    { id: 2, label: 'PoxPrime DEMO' },
    { id: 3, label: 'Demo Forex' },
    { id: 4, label: 'Standard' },
  ] as const;
  protected readonly form = new FormGroup({
    leverage: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
    accountType: new FormControl<WalletAccountType | null>(null, Validators.required),
    accountName: new FormControl('', { nonNullable: true }),
    terms: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });
  protected readonly submitting = signal(false);
  protected readonly needsRefresh = signal(false);
  protected readonly errorMessage = signal('');

  constructor() {
    this.form.controls.accountType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.loadLeverages());
  }

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.leverageRequest?.abort();
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  protected close(): void {
    if (this.submitting()) return;
    this.dialog().nativeElement.close();
    this.closed.emit(this.needsRefresh());
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected async loadLeverages(): Promise<void> {
    this.leverageRequest?.abort();
    const { accountType, leverage } = this.form.controls;
    leverage.reset({ value: null, disabled: true });
    this.leverageOptions.set(null);
    this.leverageLoadFailed.set(false);
    if (!this.needsRefresh()) this.errorMessage.set('');
    if (accountType.value === null) return;

    const request = new AbortController();
    this.leverageRequest = request;
    try {
      const options = await getWalletLeverages(accountType.value, request.signal);
      if (request.signal.aborted) return;

      this.leverageOptions.set(options);
      if (options.length) leverage.enable();
    } catch {
      if (!request.signal.aborted) this.leverageLoadFailed.set(true);
    }
  }

  protected async submit(): Promise<void> {
    const { leverage, accountType, accountName } = this.form.getRawValue();
    if (
      this.submitting() ||
      this.needsRefresh() ||
      this.form.invalid ||
      leverage === null ||
      !this.leverageOptions()?.includes(leverage) ||
      accountType === null
    )
      return;

    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      await createWallet({
        wallet_account_type: accountType,
        wallet_trading_type: this.type(),
        wallet_leverage: leverage,
        wallet_account_name: accountName.trim(),
      });
    } catch (error) {
      this.needsRefresh.set(error instanceof WalletCreationUnconfirmedError);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to open an account.');
      return;
    } finally {
      this.submitting.set(false);
    }

    if (this.destroyRef.destroyed) return;
    this.dialog().nativeElement.close();
    this.created.emit();
  }
}
