import { AxiosError, type AxiosAdapter } from 'axios';
import { api, baseUrl } from '../api/api';
import { logout } from '../api/auth/logout';
import { getUserInfo, type UserInfoResponse } from '../api/userInfo/userInfo';
import {
  authGuard,
  clearAuthSession,
  getAuthHeaders,
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from './auth';

describe('Authenticated API requests', () => {
  const session: AuthSession = {
    require2FA: false,
    member: {
      id: 1,
      username: 'member',
      email: 'member@example.com',
      m_image_url: '',
      m_image_path: '',
      m_name: 'Test',
      m_lastname: 'Member',
      isKYC: 0,
      ib: 0,
      ibType: 0,
      mt5_category: 0,
      member_roles: [],
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
    sessionUid: 'session-uid',
  };
  const profile: UserInfoResponse = {
    result: true,
    message: 'Profile retrieved.',
    data: {
      member: {
        ...session.member,
        m_phone: '123456789',
        m_phone_code: '+66',
        m_gender: '',
        m_nationality: '',
        m_country: 'Thailand',
        m_state: '',
        m_identity: '',
        isActive: 1,
        isConfirm: 1,
        campaign_name: '',
        lastLogin: '2026-11-03T00:00:00Z',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
      },
      address: {
        id: 1,
        member_id: 1,
        address_no: '',
        address_district: '',
        address_city: '',
        address_state: '',
        address_zipcode: '',
        address_stat: 1,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
      },
      isTrusted: false,
    },
  };
  const originalAdapter = api.defaults.adapter;
  const adapter = vi.fn<AxiosAdapter>();

  beforeEach(() => {
    clearAuthSession();
    adapter.mockReset();
    adapter.mockImplementation(async (config) => ({
      config,
      data: profile,
      status: 200,
      statusText: 'OK',
      headers: {},
    }));
    api.defaults.adapter = adapter;
  });

  afterEach(() => {
    clearAuthSession();
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'persists all login data and reads it back with Remember me = %s',
    (rememberMe) => {
      const selectedStorage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      otherStorage.setItem('authSession', 'old-session');

      setAuthSession(session, rememberMe);

      expect(JSON.parse(selectedStorage.getItem('authSession')!)).toEqual(session);
      expect(otherStorage.getItem('authSession')).toBeNull();
      expect(getAuthSession()).toEqual(session);
      expect(authGuard()).toBe(true);
    },
  );

  it.each([false, true])(
    'requests the profile with both auth headers from storage, Remember me = %s',
    async (rememberMe) => {
      // Use persisted login data to also cover sessions restored after a reload.
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('authSession', JSON.stringify(session));

      const response = await getUserInfo();

      expect(response).toEqual(profile);
      expect(adapter).toHaveBeenCalledTimes(1);
      const config = adapter.mock.calls[0][0];
      expect(config.method).toBe('get');
      expect(config.url).toBe('/v1/member/profile');
      expect(config.headers.get('Authorization')).toBe('Bearer access-token');
      expect(config.headers.get('x-user-id')).toBe('session-uid');
      expect(config.headers.get('Content-Type')).toBe('application/json');
      expect(config.headers.get('refreshToken')).toBeUndefined();
    },
  );

  it('rejects profile requests before sending anything when signed out', async () => {
    await expect(getUserInfo()).rejects.toThrow('Please sign in');
    expect(adapter).not.toHaveBeenCalled();
    expect(authGuard()).toBe(false);
    expect(getAuthHeaders()).toBeUndefined();
  });

  it('allows public requests without auth headers', async () => {
    await api.post('/v1/auth/login', { usernameOrEmail: 'member@example.com' });

    const config = adapter.mock.calls[0][0];
    expect(config.headers.get('Authorization')).toBeUndefined();
    expect(config.headers.get('x-user-id')).toBeUndefined();
  });

  it('reads the latest session for each request and stops attaching auth after logout', async () => {
    setAuthSession(session);
    await api.get('/v1/member/profile');

    setAuthSession({ ...session, accessToken: 'new-token', sessionUid: 'new-session' });
    await api.get('/v1/member/profile');

    clearAuthSession();
    await api.get('/v1/member/profile');

    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer access-token');
    expect(adapter.mock.calls[1][0].headers.get('Authorization')).toBe('Bearer new-token');
    expect(adapter.mock.calls[1][0].headers.get('x-user-id')).toBe('new-session');
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBeUndefined();
    expect(adapter.mock.calls[2][0].headers.get('x-user-id')).toBeUndefined();
    expect(authGuard()).toBe(false);
  });

  it.each([false, true])(
    'logs out using the stored auth headers and clears both storages, Remember me = %s',
    async (rememberMe) => {
      setAuthSession(session, rememberMe);
      adapter.mockImplementationOnce(async (config) => {
        expect(getAuthSession()).toEqual(session);
        return {
          config,
          data: { result: rememberMe ? 'success' : true, message: 'Logged out.' },
          status: 200,
          statusText: 'OK',
          headers: {},
        };
      });

      await logout();

      expect(adapter).toHaveBeenCalledTimes(1);
      const config = adapter.mock.calls[0][0];
      expect(config.method).toBe('post');
      expect(config.url).toBe('/v1/auth/logout');
      expect(JSON.parse(config.data)).toEqual({ forgetDevice: false });
      expect(config.headers.get('Authorization')).toBe('Bearer access-token');
      expect(config.headers.get('x-user-id')).toBe('session-uid');
      expect(localStorage.getItem('authSession')).toBeNull();
      expect(sessionStorage.getItem('authSession')).toBeNull();
      expect(authGuard()).toBe(false);
    },
  );

  it('clears the session after a successful logout with no response body', async () => {
    setAuthSession(session);
    adapter.mockImplementationOnce(async (config) => ({
      config,
      data: '',
      status: 204,
      statusText: 'No Content',
      headers: {},
    }));

    await logout();

    expect(getAuthSession()).toBeNull();
  });

  it.each([
    { status: 200, data: { result: false, message: 'Logout rejected.' } },
    { status: 200, data: { result: 'error', message: 'Logout rejected.' } },
    { status: 401, data: { result: true, message: 'Logout rejected.' } },
    {
      status: 500,
      data: { result: false, error: { message: 'Logout rejected.' } },
    },
    { status: 200, data: null },
  ])('keeps the session when logout fails (%#)', async ({ status, data }) => {
    setAuthSession(session);
    adapter.mockImplementationOnce(async (config) => ({
      config,
      data,
      status,
      statusText: '',
      headers: {},
    }));

    await expect(logout()).rejects.toThrow(/Logout rejected|Unable to sign out/);

    expect(getAuthSession()).toEqual(session);
  });

  it.each([
    { error: new Error('Network Error'), message: 'Unable to connect.' },
    {
      error: new AxiosError('Invalid JSON', AxiosError.ERR_BAD_RESPONSE),
      message: 'The server returned an invalid response.',
    },
  ])('keeps the session after a logout request error (%#)', async ({ error, message }) => {
    setAuthSession(session);
    adapter.mockRejectedValueOnce(error);

    await expect(logout()).rejects.toThrow(message);

    expect(getAuthSession()).toEqual(session);
  });

  it('does not send a logout request without an authenticated session', async () => {
    await expect(logout()).rejects.toThrow('Please sign in');

    expect(adapter).not.toHaveBeenCalled();
  });

  it('does not attach the session when the destination is outside the API origin', async () => {
    setAuthSession(session);
    const externalUrl = new URL('https://external.invalid/profile');
    if (new URL(baseUrl, window.location.href).origin === externalUrl.origin) {
      externalUrl.hostname = 'other.invalid';
    }

    await api.get(externalUrl.href);

    const config = adapter.mock.calls[0][0];
    expect(config.headers.get('Authorization')).toBeUndefined();
    expect(config.headers.get('x-user-id')).toBeUndefined();
  });

  it('recovers from corrupt session storage using a valid remembered session', () => {
    sessionStorage.setItem('authSession', '{invalid json');
    localStorage.setItem('authSession', JSON.stringify(session));

    expect(getAuthSession()).toEqual(session);
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it.each([
    null,
    'invalid-session',
    { ...session, accessToken: '' },
    { ...session, sessionUid: '' },
    { ...session, sessionUid: '   ' },
    { ...session, require2FA: true },
    { ...session, expiresIn: 0 },
  ])('rejects invalid stored authentication data (%#)', async (invalidSession) => {
    sessionStorage.setItem('authSession', JSON.stringify(invalidSession));

    await expect(getUserInfo()).rejects.toThrow('Please sign in');

    expect(sessionStorage.getItem('authSession')).toBeNull();
    expect(adapter).not.toHaveBeenCalled();
  });

  it('rejects login data without a session UID before storing it', () => {
    expect(() => setAuthSession({ ...session, sessionUid: '' })).toThrow(
      'invalid authentication session',
    );
    expect(localStorage.getItem('authSession')).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  it('continues without auth when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable.');
    });

    await api.post('/v1/auth/login', {});

    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBeUndefined();
    expect(authGuard()).toBe(false);
  });
});
