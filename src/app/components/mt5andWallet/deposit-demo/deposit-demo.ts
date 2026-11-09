import { CurrencyPipe } from '@angular/common';
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
import { depositDemoWallet } from '@shared/api/wallet/depositDemoWallet';
import { getWalletId, type WalletDetail } from '@shared/api/wallet/getWalletId';
import { walletAccountTypes } from '../../../../shared/model/wallet-account-types';

const depositComment = 'Deposit';
const depositError = 'Unable to deposit funds. Please try again.';

type DemoWallet = Pick<
  WalletDetail,
  | 'wallet_account_name'
  | 'wallet_account_no'
  | 'wall_account_type'
  | 'wallet_account_type'
  | 'wallet_trading_type'
>;

@Component({
  imports: [Button, CurrencyPipe, InputComponent],
  selector: 'app-deposit-demo',
  templateUrl: './deposit-demo.html',
})
export class DepositDemo {
  readonly account = input.required<DemoWallet | string>();
  readonly closed = output<boolean>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly walletRequest = resource({
    params: () => {
      const account = this.account();
      return typeof account === 'string' ? account : undefined;
    },
    loader: async ({ params, abortSignal }) => {
      const response = await getWalletId(params, abortSignal);
      const wallet = response?.data?.wallet;
      if (
        response?.result !== true ||
        wallet?.wallet_trading_type !== 'demo' ||
        !wallet.wallet_account_no
      ) {
        throw new Error('Unable to load demo wallet details.');
      }
      return wallet;
    },
  });
  protected readonly wallet = computed(() => {
    const account = this.account();
    if (typeof account !== 'string') return account;
    return this.walletRequest.hasValue() ? this.walletRequest.value() : undefined;
  });
  protected readonly investments: readonly number[] = [100, 1_000, 10_000, 100_000];
  protected readonly submitting = signal(false);
  protected readonly needsRefresh = signal(false);
  protected readonly error = signal('');
  protected readonly accountType = computed(() => {
    const wallet = this.wallet();
    const id = Number(wallet?.wall_account_type ?? wallet?.wallet_account_type);
    return walletAccountTypes.find((type) => type.id === id)?.label ?? '—';
  });

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.submitting()) this.close(this.needsRefresh());
  }

  protected async confirm(event: Event, investment: string): Promise<void> {
    event.preventDefault();
    const wallet = this.wallet();
    const balance = Number(investment);
    if (
      this.submitting() ||
      this.needsRefresh() ||
      wallet?.wallet_trading_type !== 'demo' ||
      !wallet.wallet_account_no ||
      !this.investments.includes(balance)
    )
      return;

    this.submitting.set(true);
    this.error.set('');
    try {
      const response = await depositDemoWallet(wallet.wallet_account_no, {
        balance,
        comment: depositComment,
      });
      if (this.destroyRef.destroyed) return;
      if (typeof response?.result !== 'boolean') throw new Error('Unexpected deposit response.');
      if (!response.result) {
        this.error.set(response.message || depositError);
        return;
      }
      this.close(true);
    } catch {
      if (!this.destroyRef.destroyed) {
        this.needsRefresh.set(true);
        this.error.set('Could not confirm the deposit. Close this window to refresh your balance.');
      }
    } finally {
      if (!this.destroyRef.destroyed) this.submitting.set(false);
    }
  }

  private close(refreshBalance: boolean): void {
    this.dialog().nativeElement.close();
    this.closed.emit(refreshBalance);
  }
}
