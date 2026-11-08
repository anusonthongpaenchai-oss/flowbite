import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn } from '@angular/router';
import { checkWalletKyc } from '../shared/guard/wallet-kyc';

export const walletKycGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const status = await checkWalletKyc();
  if (status === 'verified') return true;

  const previousUrl = /^\/(?:dashboard|user(?:-info)?)(?:[/?;#]|$)/.test(router.url)
    ? router.url
    : '/dashboard';
  return new RedirectCommand(router.parseUrl(previousUrl), {
    info: status,
    onSameUrlNavigation: 'reload',
  });
};
