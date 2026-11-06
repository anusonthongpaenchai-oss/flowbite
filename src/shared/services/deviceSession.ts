import { environment } from '../../environments/environment';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && value.length === 36 && uuidPattern.test(value);
}

function storageKey(): string {
  const apiOrigin = new URL(environment.apiBaseUrl, window.location.href).origin;
  return `deviceSessionUid:${apiOrigin}`;
}

// This identifies a device; only the backend decides whether it is trusted.
export function saveDeviceSessionUid(sessionUid: string): void {
  if (typeof window === 'undefined' || !isUuid(sessionUid)) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(), sessionUid);
  } catch {
    // A device that cannot be remembered can still use the normal OTP flow.
  }
}

export function getDeviceSessionUid(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const key = storageKey();
    const sessionUid = window.localStorage.getItem(key);
    if (isUuid(sessionUid)) {
      return sessionUid;
    }
    if (sessionUid !== null) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Omit x-user-id when persistent storage is unavailable.
  }

  return undefined;
}
