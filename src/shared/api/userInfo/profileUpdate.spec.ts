import { AxiosError, type AxiosAdapter } from 'axios';
import { api } from '../api';
import { clearAuthSession, setAuthSession, type AuthSession } from '../../guard/auth';
import { profileUpdate, type ProfileUpdateRequest } from './profileUpdate';

describe('profileUpdate', () => {
  const originalAdapter = api.defaults.adapter;
  const adapter = vi.fn<AxiosAdapter>();
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
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    expiresIn: 3600,
    sessionUid: 'test-session',
  };
  const body: ProfileUpdateRequest = {
    member: {
      m_name: 'Test',
      m_lastname: 'Member',
      m_country: 'Thailand',
      m_phone: '0812345678',
      m_gender: '',
    },
    address: {
      address_no: '123 Main Road',
      address_district: 'Khlong Tan Nuea',
      address_city: 'Watthana',
      address_state: 'Bangkok',
      address_zipcode: '10110',
    },
  };

  beforeEach(() => {
    clearAuthSession();
    setAuthSession(session);
    adapter.mockReset();
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { result: true, message: 'Profile updated.' },
    }));
    api.defaults.adapter = adapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    clearAuthSession();
  });

  it('sends a normalized PUT payload with auth headers and preserves the original values', async () => {
    const request = {
      member: { ...body.member, m_name: ' Test ', unexpected: 'omit this' },
      address: { ...body.address, address_no: ' 123 Main Road ' },
    };

    await expect(profileUpdate(request)).resolves.toEqual({
      result: true,
      message: 'Profile updated.',
    });

    expect(adapter).toHaveBeenCalledTimes(1);
    const config = adapter.mock.calls[0][0];
    expect(config.method).toBe('put');
    expect(config.url).toBe('/v1/member/profile/update');
    expect(JSON.parse(config.data)).toEqual(body);
    expect(config.headers.get('Authorization')).toBe('Bearer test-token');
    expect(config.headers.get('x-user-id')).toBe('test-session');
    expect(request.member.m_name).toBe(' Test ');
  });

  it('requires an authenticated session before sending a request', async () => {
    clearAuthSession();
    await expect(profileUpdate(body)).rejects.toThrow('Please sign in');
    expect(adapter).not.toHaveBeenCalled();
  });

  it.each([
    ['member', 'm_name', '   '],
    ['member', 'm_lastname', '123'],
    ['member', 'm_name', 'a'.repeat(101)],
    ['member', 'm_country', ''],
    ['member', 'm_phone', '123abc789'],
    ['member', 'm_phone', '123456'],
    ['member', 'm_phone', '1'.repeat(16)],
    ['member', 'm_gender', 'a'.repeat(51)],
    ['address', 'address_no', ' '],
    ['address', 'address_no', 'a'.repeat(256)],
    ['address', 'address_district', ''],
    ['address', 'address_city', ''],
    ['address', 'address_state', ''],
    ['address', 'address_zipcode', '10110!'],
    ['address', 'address_zipcode', 'a'.repeat(21)],
  ] as const)('rejects invalid %s.%s before sending', async (group, name, value) => {
    const request = { ...body, [group]: { ...body[group], [name]: value } };
    await expect(profileUpdate(request)).rejects.toThrow();
    expect(adapter).not.toHaveBeenCalled();
  });

  it.each([null, { member: null }, { member: body.member, address: null }])(
    'rejects malformed request data',
    async (request) => {
      await expect(profileUpdate(request as unknown as ProfileUpdateRequest)).rejects.toThrow();
      expect(adapter).not.toHaveBeenCalled();
    },
  );

  it('accepts international postal codes and names with apostrophes or hyphens', async () => {
    await expect(
      profileUpdate({
        member: { ...body.member, m_name: 'Mary-Jane', m_lastname: 'O’Neill', m_country: 'Canada' },
        address: { ...body.address, address_zipcode: 'H3Z 2Y7' },
      }),
    ).resolves.toMatchObject({ result: true });
  });

  it.each([
    [200, { result: false, message: 'Update rejected.' }, 'Update rejected.'],
    [
      422,
      { message: 'Invalid profile.', error: { message: 'Phone is already in use.' } },
      'Phone is already in use.',
    ],
    [401, {}, 'Please sign in again.'],
    [500, '<html>Server error</html>', 'Unable to update'],
    [200, null, 'invalid response'],
    [200, { result: 'true', message: 'Invalid success flag.' }, 'invalid response'],
    [200, { message: 'Missing success flag.' }, 'invalid response'],
  ])('handles an HTTP %s error or malformed response', async (status, data, message) => {
    adapter.mockImplementationOnce(async (config) => ({
      config,
      status: status as number,
      data,
      statusText: '',
      headers: {},
    }));

    await expect(profileUpdate(body)).rejects.toThrow(message as string);
  });

  it('uses a default success message if the server omits its message', async () => {
    adapter.mockImplementationOnce(async (config) => ({
      config,
      status: 200,
      data: { result: true },
      statusText: 'OK',
      headers: {},
    }));
    await expect(profileUpdate(body)).resolves.toEqual({
      result: true,
      message: 'Profile updated successfully.',
    });
  });

  it.each([
    [AxiosError.ERR_NETWORK, 'Unable to connect'],
    [AxiosError.ECONNABORTED, 'Unable to connect'],
    [AxiosError.ERR_BAD_RESPONSE, 'invalid response'],
  ])('reports transport errors for %s', async (code, message) => {
    adapter.mockRejectedValueOnce(new AxiosError('Request failed', code));
    await expect(profileUpdate(body)).rejects.toThrow(message);
  });
});
