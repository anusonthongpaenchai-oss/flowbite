import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { api } from '../shared/api/api';
import { clearAuthSession, getAuthSession, setAuthSession } from '../shared/guard/auth';
import { stopTokenRefresh } from '../shared/services/tokenRefreshScheduler';
import { App } from './app';

// Startup must restore the saved deadline, even when the login page is never submitted.
describe('App token refresh lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T00:00:00Z'));
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    setAuthSession(
      {
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
        accessToken: 'access',
        refreshToken: 'refresh',
        sessionUid: 'session',
        expiresIn: 3600,
        tokenExpiresAt: Date.now() + 120_000,
      },
      true,
    );
    vi.spyOn(api, 'post').mockResolvedValue({
      status: 200,
      data: {
        result: true,
        data: { accessToken: 'next-access', refreshToken: 'next-refresh', expiresIn: 3600 },
      },
    } as Awaited<ReturnType<typeof api.post>>);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    stopTokenRefresh();
    clearAuthSession();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('automatically resumes refresh for a remembered session on app creation', async () => {
    TestBed.createComponent(App);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(getAuthSession()?.accessToken).toBe('next-access');
  });

  it('redirects to login when refresh is rejected', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 401, data: { result: false } } as Awaited<
      ReturnType<typeof api.post>
    >);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.createComponent(App);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    expect(getAuthSession()).toBeNull();
  });

  it('cancels timers when the app is destroyed', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.post).not.toHaveBeenCalled();
  });
});
