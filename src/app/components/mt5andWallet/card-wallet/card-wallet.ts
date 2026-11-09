import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AlertCard } from '@components/alert-card/alert-card';
import { Button } from '@components/ui/button/button';
import { deleteWallet } from '@shared/api/wallet/deleteWallet';
import { getWalletId, type WalletResponseData } from '@shared/api/wallet/getWalletId';
import { getAuthSession } from '@shared/guard/auth';
import { ChangeLeverage } from '../change-leverage/change-leverage';
import { ChangePasswordWallet } from '../change-password-wallet/change-password-wallet';
import { DepositDemo } from '../deposit-demo/deposit-demo';

const themes = {
  gray: { coin: 'svg/cardWallet/grayCoin.svg', color: '#D1D5DB' },
  orange: { coin: 'svg/cardWallet/orangeCoin.svg', color: '#FBD5D5' },
  yellow: { coin: 'svg/cardWallet/yellowCoin.svg', color: '#FCE96A' },
  brown: { coin: 'svg/cardWallet/brownCoin.svg', color: '#EFD2A4' },
};

const accountThemes: Partial<Record<number, (typeof themes)[keyof typeof themes]>> = {
  1: themes.gray,
  2: themes.orange,
  3: themes.yellow,
  13: themes.yellow,
  4: themes.brown,
};

const passwordFields = [
  { name: 'master', label: 'Master Password', key: 'wallet_master_password', type: 'main' },
  { name: 'investor', label: 'Investor Password', key: 'wallet_investor_password', type: 'investor' },
] as const;

type PasswordField = (typeof passwordFields)[number];

function amount(value: number | string | null | undefined): number | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

@Component({
  imports: [AlertCard, Button, ChangeLeverage, ChangePasswordWallet, DecimalPipe, DepositDemo],
  selector: 'app-card-wallet',
  templateUrl: './card-wallet.html',
})
export class CardWallet {
  readonly accountNumber = input.required<string>();
  readonly closed = output<void>();
  readonly deleted = output<void>();
  readonly balanceRefreshRequested = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private request?: AbortController;
  private readonly member = getAuthSession()?.member;

  protected readonly memberName =
    [this.member?.m_name, this.member?.m_lastname].filter(Boolean).join(' ').trim() ||
    this.member?.username ||
    '';
  protected readonly memberImage = signal(this.member?.m_image_url ?? '');
  protected readonly platform = 'MT5';
  protected readonly passwordFields = passwordFields;
  protected readonly revealed = signal({ master: false, investor: false });
  protected readonly data = signal<WalletResponseData | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');
  protected readonly showDeposit = signal(false);
  protected readonly showChangeLeverage = signal(false);
  protected readonly editingPassword = signal<PasswordField | null>(null);
  protected readonly canDeposit = computed(() => {
    const wallet = this.data()?.wallet;
    return wallet?.wallet_trading_type === 'demo' && !!wallet.wallet_account_no;
  });
  protected readonly canDelete = computed(() => this.data()?.wallet.wallet_type === 'trading');
  protected readonly theme = computed(
    () => accountThemes[Number(this.data()?.wallet.wallet_account_type)] ?? themes.gray,
  );
  protected readonly gradient = computed(
    () => `linear-gradient(275.98deg, #FFFFFF 1.24%, ${this.theme().color} 100%)`,
  );
  protected readonly balance = computed(() => amount(this.data()?.wallet.wallet_balance));
  protected readonly currency = computed(() => {
    const data = this.data();
    return data?.wallet.wallet_currency || data?.mt5_data?.currency || '';
  });
  protected readonly leverage = computed(() => {
    const data = this.data();
    return amount(
      data?.wallet.wallet_leverage ?? data?.mt5_data?.leverage ?? data?.mt5_data?.Leverage,
    );
  });
  protected readonly metrics = computed(() => {
    const data = this.data();
    return [
      {
        label: 'Credit',
        value: amount(
          data?.wallet.wallet_credit ?? data?.mt5_data?.credit ?? data?.mt5_data?.Credit,
        ),
      },
      {
        label: 'Equity',
        value: amount(
          data?.wallet.wallet_equity ?? data?.mt5_data?.equity ?? data?.mt5_data?.Equity,
        ),
      },
      {
        label: 'Margin',
        value: amount(
          data?.wallet.wallet_margin ?? data?.mt5_data?.margin ?? data?.mt5_data?.Margin,
        ),
      },
    ];
  });

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
    void this.load();
  }

  ngOnDestroy(): void {
    this.request?.abort();
  }

  protected togglePassword(name: PasswordField['name']): void {
    this.revealed.update((revealed) => ({ ...revealed, [name]: !revealed[name] }));
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (this.deleting() || this.showDeposit() || this.showChangeLeverage() || this.editingPassword()) {
      return;
    }
    this.request?.abort();
    this.data.set(null);
    this.revealed.set({ master: false, investor: false });
    this.dialog().nativeElement.close();
    this.closed.emit();
  }

  protected requestDelete(): void {
    if (!this.canDelete() || !this.data()?.wallet.wallet_account_no || this.deleting()) return;
    this.deleteError.set('');
    this.confirmingDelete.set(true);
  }

  protected openDeposit(): void {
    if (this.canDeposit()) this.showDeposit.set(true);
  }

  protected closeDeposit(refreshBalance: boolean): void {
    this.showDeposit.set(false);
    if (refreshBalance) {
      this.data.set(null);
      void this.load();
      this.balanceRefreshRequested.emit();
    }
  }

  protected closeChangeLeverage(leverage: number | null): void {
    this.showChangeLeverage.set(false);
    if (leverage === null) return;

    this.data.update((data) =>
      data ? { ...data, wallet: { ...data.wallet, wallet_leverage: leverage } } : data,
    );
  }

  protected closeChangePassword(field: PasswordField, password: string | null): void {
    this.editingPassword.set(null);
    if (password === null) return;

    this.revealed.update((revealed) => ({ ...revealed, [field.name]: false }));
    this.data.update((data) =>
      data ? { ...data, wallet: { ...data.wallet, [field.key]: password } } : data,
    );
  }

  protected async confirmDelete(): Promise<void> {
    const accountNumber = this.data()?.wallet.wallet_account_no;
    if (!this.canDelete() || !this.confirmingDelete() || !accountNumber || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      const response = await deleteWallet(accountNumber);
      if (this.destroyRef.destroyed) return;
      if (response?.result !== true) {
        this.deleteError.set(response?.message || 'Unable to delete account. Please try again.');
        return;
      }
      this.confirmingDelete.set(false);
      this.deleting.set(false);
      this.deleted.emit();
      this.close();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.deleteError.set('Unable to delete account. Please try again.');
      }
    } finally {
      if (!this.destroyRef.destroyed) this.deleting.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.loadFailed.set(false);
    try {
      const response = await getWalletId(this.accountNumber(), request.signal);
      if (request.signal.aborted) return;
      if (response?.result !== true || !response.data?.wallet) {
        this.loadFailed.set(true);
        return;
      }
      this.data.set(response.data);
    } catch {
      if (!request.signal.aborted) this.loadFailed.set(true);
    }
  }
}
