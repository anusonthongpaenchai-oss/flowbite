import { refreshToken, RefreshTokenError } from '../api/auth/refreshToken';
import {
  clearAuthSession,
  getRememberedAuthSession,
  onAuthSessionChange,
  setAuthSession,
  type AuthSession,
} from '../guard/auth';

const refreshAheadMs = 60_000;
const retryDelays = [5_000, 10_000, 20_000];
let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;
let onExpired: (() => void) | undefined;
let sessionKey = '';
let generation = 0;
let pending = false;
let failures = 0;
let dueAt = 0;
let expireOnWake = false;

function key(session: AuthSession | null): string {
  return session ? JSON.stringify(session) : '';
}

function cancelTimer(): void {
  clearTimeout(timer);
  timer = undefined;
}

function armTimer(): void {
  cancelTimer();
  timer = setTimeout(wake, Math.min(Math.max(0, dueAt - Date.now()), 2_147_483_647));
}

function synchronize(force = false): void {
  const session = getRememberedAuthSession();
  const nextKey = key(session);
  if (!force && nextKey === sessionKey) return;

  generation++;
  cancelTimer();
  sessionKey = nextKey;
  pending = false;
  failures = 0;
  expireOnWake = false;
  if (!session) return;

  // Very short lifetimes cannot provide a full minute of lead time.
  // Refresh halfway through those lifetimes, with a minimum one-second interval.
  const shortLifetime = session.expiresIn * 1000 <= refreshAheadMs;
  dueAt =
    session.tokenExpiresAt === undefined
      ? Date.now()
      : shortLifetime
        ? Math.max(Date.now() + 1000, session.tokenExpiresAt - session.expiresIn * 500)
        : session.tokenExpiresAt - refreshAheadMs;
  armTimer();
}

function expireSession(): void {
  clearAuthSession();
  onExpired?.();
}

function wake(): void {
  synchronize();
  if (!sessionKey || pending) return;
  if (Date.now() < dueAt) {
    armTimer();
    return;
  }
  if (expireOnWake) {
    expireSession();
    return;
  }
  void refreshSession();
}

async function refreshSession(): Promise<void> {
  const session = getRememberedAuthSession();
  if (!session || key(session) !== sessionKey) {
    synchronize();
    return;
  }

  cancelTimer();
  pending = true;
  const requestGeneration = generation;
  const isCurrent = () =>
    requestGeneration === generation && key(getRememberedAuthSession()) === key(session);

  try {
    const response = await refreshToken({ refreshToken: session.refreshToken });
    if (!isCurrent()) return;

    setAuthSession(
      {
        ...session,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn,
        tokenExpiresAt: Date.now() + response.data.expiresIn * 1000,
      },
      true,
    );
  } catch (error) {
    if (!isCurrent()) return;
    const remaining = (session.tokenExpiresAt ?? Infinity) - Date.now();
    if (!(error instanceof RefreshTokenError) || !error.retryable || remaining <= 0) {
      expireSession();
      return;
    }

    const delay = retryDelays[failures++];
    if (delay === undefined) {
      if (!Number.isFinite(remaining)) {
        expireSession();
        return;
      }
      expireOnWake = true;
      dueAt = session.tokenExpiresAt!;
    } else {
      expireOnWake = remaining <= delay;
      dueAt = Date.now() + Math.min(delay, remaining);
    }
    armTimer();
  } finally {
    if (requestGeneration === generation) pending = false;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') wake();
}

function onStorageChange(event: StorageEvent): void {
  if (event.key === 'authSession' || event.key === null) synchronize();
}

export function startTokenRefresh(expired?: () => void): void {
  if (typeof window === 'undefined') return;
  if (expired) onExpired = expired;
  if (!unsubscribe) {
    unsubscribe = onAuthSessionChange(() => synchronize(true));
    window.addEventListener('storage', onStorageChange);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  synchronize();
}

export function stopTokenRefresh(): void {
  generation++;
  cancelTimer();
  unsubscribe?.();
  unsubscribe = undefined;
  onExpired = undefined;
  sessionKey = '';
  pending = false;
  if (typeof window === 'undefined') return;
  window.removeEventListener('storage', onStorageChange);
  window.removeEventListener('focus', wake);
  window.removeEventListener('online', wake);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
