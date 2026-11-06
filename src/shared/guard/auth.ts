import type { LoginData } from '../api/auth/login';
import { saveDeviceSessionUid } from '../services/deviceSession';

export type AuthSession = LoginData & {
  tokenExpiresAt?: number;
  twoFaEnabled?: boolean;
  rememberDevice?: boolean;
};

export type AuthHeaders = {
  Authorization: string;
  'x-user-id': string;
};

const storageKey = 'authSession';
const sessionListeners = new Set<() => void>();

export function onAuthSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    session.require2FA === false &&
    typeof session.accessToken === 'string' &&
    session.accessToken.trim().length > 0 &&
    typeof session.sessionUid === 'string' &&
    session.sessionUid.trim().length > 0 &&
    typeof session.refreshToken === 'string' &&
    session.refreshToken.trim().length > 0 &&
    typeof session.expiresIn === 'number' &&
    Number.isFinite(session.expiresIn) &&
    session.expiresIn > 0 &&
    (session.tokenExpiresAt === undefined ||
      (typeof session.tokenExpiresAt === 'number' &&
        Number.isFinite(session.tokenExpiresAt) &&
        session.tokenExpiresAt > 0)) &&
    !!session.member &&
    typeof session.member === 'object' &&
    !Array.isArray(session.member)
  );
}

export function setAuthSession(session: AuthSession, rememberMe = false): void {
  if (!isAuthSession(session)) {
    throw new Error('The server returned an invalid authentication session. Please try again.');
  }

  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(storageKey, JSON.stringify(session));
  try {
    const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;
    otherStorage.removeItem(storageKey);
  } catch {}
  saveDeviceSessionUid(session.sessionUid);
  sessionListeners.forEach((listener) => listener());
}

function readAuthSession(): { session: AuthSession; rememberMe: boolean } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const storageName of ['sessionStorage', 'localStorage'] as const) {
    try {
      const storage = window[storageName];
      const storedSession = storage.getItem(storageKey);

      if (!storedSession) {
        continue;
      }

      let session: unknown;

      try {
        session = JSON.parse(storedSession);
      } catch {}

      if (isAuthSession(session)) {
        return { session, rememberMe: storageName === 'localStorage' };
      }

      storage.removeItem(storageKey);
    } catch {}
  }

  return null;
}

export function getAuthSession(): AuthSession | null {
  return readAuthSession()?.session ?? null;
}

export function getRememberedAuthSession(): AuthSession | null {
  const stored = readAuthSession();
  return stored?.rememberMe ? stored.session : null;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Migrate sessions created before device IDs were stored separately.
  const session = getAuthSession();
  if (session) {
    saveDeviceSessionUid(session.sessionUid);
  }

  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      window[storageName].removeItem(storageKey);
    } catch {}
  }
  if (getAuthSession()) {
    throw new Error('Unable to clear your session. Please try again.');
  }
  sessionListeners.forEach((listener) => listener());
}

export function authGuard(): boolean {
  return getAuthSession() !== null;
}
export function getAuthHeaders(): AuthHeaders | undefined {
  const session = getAuthSession();

  if (!session) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${session.accessToken}`,
    'x-user-id': session.sessionUid,
  };
}
