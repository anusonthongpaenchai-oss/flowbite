import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from '@components/ui/button/button';
import { InputComponent } from '@components/ui/input/input';
import { editLeverages } from '@shared/api/wallet/editLeverages';
import type { WalletDetail } from '@shared/api/wallet/getWalletId';
import { getWalletLeverages } from '@shared/api/wallet/getWalletLeverages';
import { walletAccountTypes } from '@shared/model/wallet-account-types';

type ChangeLeverageDetail = Pick<
  WalletDetail,
  | 'wallet_account_name'
  | 'wallet_account_no'
  | 'wall_account_type'
  | 'wallet_account_type'
  | 'wallet_leverage'
>;

const saveError = 'Unable to change leverage. Please try again.';

@Component({
  imports: [Button, InputComponent],
  selector: 'app-change-leverage',
  templateUrl: './change-leverage.html',
})
export class ChangeLeverage {
  readonly account = input.required<ChangeLeverageDetail>();
  readonly closed = output<number | null>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly accountType = computed(() => {
    const { wall_account_type, wallet_account_type } = this.account();
    return (
      walletAccountTypes.find((type) => type.id === Number(wall_account_type)) ??
      walletAccountTypes.find((type) => type.id === Number(wallet_account_type))
    );
  });
  protected readonly leverages = resource({
    params: () => this.accountType()?.id,
    loader: ({ params, abortSignal }) => getWalletLeverages(params, abortSignal),
  });
  protected readonly selectedLeverage = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.submitting()) this.close(null);
  }

  protected async confirm(event: Event): Promise<void> {
    event.preventDefault();
    const accountNumber = this.account().wallet_account_no;
    const leverage = Number(this.selectedLeverage());
    if (
      this.submitting() ||
      !accountNumber ||
      !this.leverages.hasValue() ||
      !this.leverages.value().includes(leverage)
    ) {
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    try {
      const response = await editLeverages(accountNumber, leverage);
      if (this.destroyRef.destroyed) return;
      if (response?.result !== true) {
        this.error.set(response?.message || saveError);
        return;
      }
      this.close(response.data?.wallet?.wallet_leverage ?? leverage);
    } catch {
      if (!this.destroyRef.destroyed) this.error.set(saveError);
    } finally {
      if (!this.destroyRef.destroyed) this.submitting.set(false);
    }
  }

  private close(leverage: number | null): void {
    this.dialog().nativeElement.close();
    this.closed.emit(leverage);
  }
}
