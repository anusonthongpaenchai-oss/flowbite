import { isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

export type PasswordRequest = {
  type: 'main' | 'investor';
  password: string;
} & (
  | { otpMethod: 'sms' | 'email'; memberRef: string; otpCode: string; token?: never }
  | { otpMethod: 'totp'; token: string; memberRef?: never; otpCode?: never }
);

type PasswordResponse = {
  result: boolean;
  message?: string;
  error?: { message?: string };
};

const saveError = 'Unable to change your password. Please try again.';

export async function changePasswordWallet(
  accountNumber: string,
  body: PasswordRequest,
): Promise<void> {
  if (!authGuard()) {
    throw new Error('Please sign in to change your wallet password.');
  }

  const { data } = await api
    .post<PasswordResponse>(
      `/v1/wallet/user/${encodeURIComponent(accountNumber)}/password/change`,
      body,
    )
    .catch((error: unknown) => {
      const response = isAxiosError<PasswordResponse>(error) ? error.response?.data : undefined;
      throw new Error(response?.error?.message || response?.message || saveError);
    });

  if (data?.result !== true) {
    throw new Error(data?.error?.message || data?.message || saveError);
  }
}
