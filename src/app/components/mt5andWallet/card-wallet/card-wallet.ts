import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { Button } from '@components/ui/button/button';
import { getWalletId, type WalletResponseData } from '@shared/api/wallet/getWalletId';
import { getAuthSession } from '@shared/guard/auth';

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
  { name: 'master', label: 'Master Password', key: 'wallet_master_password' },
  { name: 'investor', label: 'Investor Password', key: 'wallet_investor_password' },
] as const;

function amount(value: number | string | null | undefined): number | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

@Component({
  imports: [Button, DecimalPipe],
  selector: 'app-card-wallet',
  templateUrl: './card-wallet.html',
})
export class CardWallet {
  readonly accountNumber = input.required<string>();
  readonly closed = output<void>();

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

  protected togglePassword(name: (typeof passwordFields)[number]['name']): void {
    this.revealed.update((revealed) => ({ ...revealed, [name]: !revealed[name] }));
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    this.request?.abort();
    this.data.set(null);
    this.revealed.set({ master: false, investor: false });
    this.dialog().nativeElement.close();
    this.closed.emit();
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
