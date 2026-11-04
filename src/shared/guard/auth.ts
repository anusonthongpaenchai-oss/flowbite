import type { LoginData } from '../api/auth/login';

export type AuthSession = LoginData;

export type AuthHeaders = {
  Authorization: string;
  'x-user-id': string;
};

const storageKey = 'authSession';

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
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;

  storage.setItem(storageKey, JSON.stringify(session));
  otherStorage.removeItem(storageKey);
}

export function getAuthSession(): AuthSession | null {
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
      } catch {
        // Discard malformed data and try the other storage.
      }

      if (isAuthSession(session)) {
        return session;
      }

      storage.removeItem(storageKey);
    } catch {
      // A browser may disable storage; requests can still proceed without auth.
    }
  }

  return null;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
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
