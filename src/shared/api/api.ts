import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
  type HttpResponse,
} from '@angular/common/http';
import { DestroyRef, inject, provideEnvironmentInitializer } from '@angular/core';
import { firstValueFrom, from, fromEvent, switchMap, takeUntil, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { getAuthHeaders } from '../guard/auth';
import { getDeviceSessionUid } from '../services/deviceSession';

export const baseUrl = environment.apiBaseUrl;

const deviceSessionPaths = new Set([
  '/v1/auth/login',
  '/v1/auth/2fa/verify',
  '/v1/auth/refresh',
  '/v1/member/register',
]);

export type ApiResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: HttpHeaders;
};

export class ApiError<T = unknown> extends Error {
  constructor(
    message: string,
    readonly response?: ApiResponse<T>,
    readonly invalidJson = false,
  ) {
    super(message);
  }
}

export function isApiError<T>(error: unknown): error is ApiError<T> {
  return error instanceof ApiError;
}

type ApiOptions = {
  validateStatus?: (status: number) => boolean;
  signal?: AbortSignal;
  timeout?: number;
};

let client: HttpClient | undefined;

// The Promise APIs are also called by router guards and the refresh timer.
export const initializeApi = provideEnvironmentInitializer(() => {
  const http = inject(HttpClient);
  client = http;
  inject(DestroyRef).onDestroy(() => {
    if (client === http) client = undefined;
  });
});

function headerValue(value: string): string {
  // XHR accepts byte strings and rejects control characters in header values.
  return value.replace(/[^\u0009\u0020-\u007e\u0080-\u00ff]+/g, '').replace(/^[ \t]+|[ \t]+$/g, '');
}

function readXsrfCookie(): string | undefined {
  return document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)?.[1];
}

function decodeXsrfCookie(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readXsrfCookieAsync(store: CookieStore): Promise<string | undefined> {
  try {
    return (await store.get('XSRF-TOKEN'))?.value;
  } catch {
    return readXsrfCookie();
  }
}

function timeoutError(ms: number | undefined): ApiError {
  return new ApiError(ms ? `timeout of ${ms}ms exceeded` : 'timeout exceeded');
}

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const requestUrl = new URL(request.url, window.location.href);
  const apiUrl = new URL(baseUrl, window.location.href);
  let headers = request.headers;

  if (requestUrl.origin === apiUrl.origin) {
    const auth = getAuthHeaders();
    if (auth) {
      headers = headers
        .set('Authorization', headerValue(auth.Authorization))
        .set('x-user-id', headerValue(auth['x-user-id']));
    } else if (
      request.method === 'POST' &&
      deviceSessionPaths.has(requestUrl.pathname.replace(/\/+$/, '')) &&
      !headers.has('x-user-id')
    ) {
      const sessionUid = getDeviceSessionUid();
      if (sessionUid) headers = headers.set('x-user-id', sessionUid);
    }
  }

  // Header lookup and dispatch run in separate microtasks, leaving time for cancellation.
  return from(Promise.resolve()).pipe(
    switchMap(() => sendWithXsrf(request.clone({ headers }), next)),
  );
};

function sendWithXsrf(request: HttpRequest<unknown>, next: HttpHandlerFn) {
  // Preserve same-origin XSRF on every method, including GET.
  if (new URL(request.url, document.baseURI).origin !== window.location.origin) {
    return next(request);
  }

  const send = (cookie: string | undefined, remaining = request.timeout) => {
    const headers = cookie
      ? request.headers.set('X-XSRF-TOKEN', headerValue(decodeXsrfCookie(cookie)))
      : request.headers;
    return next(request.clone({ headers, timeout: remaining }));
  };

  let store: CookieStore | undefined;
  try {
    store = window.cookieStore;
  } catch {
    // Some browser contexts restrict access to the Cookie Store API.
  }
  if (!store?.get) return send(readXsrfCookie());

  const started = performance.now();
  const cookie = from(readXsrfCookieAsync(store));
  const ms = request.timeout;
  if (ms === undefined) return cookie.pipe(switchMap((value) => send(value)));

  // Reading Cookie Store and making the request share the original timeout budget.
  return cookie.pipe(
    timeout({ first: ms, with: () => throwError(() => timeoutError(ms)) }),
    switchMap((value) => {
      const remaining = Math.ceil(ms - (performance.now() - started));
      if (remaining <= 0) throw timeoutError(ms);
      return send(value, remaining);
    }),
  );
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: unknown,
  { validateStatus, timeout, signal }: ApiOptions = {},
): Promise<ApiResponse<T>> {
  // Interceptors read storage at dispatch, after the caller's synchronous work.
  await Promise.resolve();
  if (signal?.aborted) throw new ApiError('canceled');
  if (!client) throw new Error('HTTP client is not initialized.');

  const url = /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path)
    ? path
    : `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const headers =
    body === undefined || body instanceof FormData
      ? undefined
      : new HttpHeaders({ 'Content-Type': 'application/json' });

  // Read text so strict JSON parsing applies to both success and error responses.
  const response = client.request(method, url, {
    body,
    headers,
    timeout,
    observe: 'response',
    responseType: 'text',
  });
  let result: HttpResponse<string> | HttpErrorResponse;
  let data: string;

  try {
    const successResponse = await firstValueFrom(
      signal ? response.pipe(takeUntil(fromEvent(signal, 'abort'))) : response,
    );
    result = successResponse;
    data = successResponse.body ?? '';
  } catch (error) {
    if (signal?.aborted) throw new ApiError('canceled');
    if (!(error instanceof HttpErrorResponse)) throw error;
    if (error.error?.name === 'TimeoutError') throw timeoutError(timeout);
    if (!error.status || (error.error !== null && typeof error.error !== 'string')) {
      throw new ApiError(
        error.error?.type === 'abort' ? 'Request aborted' : error.error?.message || 'Network Error',
      );
    }
    result = error;
    data = error.error ?? '';
  }

  if (signal?.aborted) throw new ApiError('canceled');

  const { status, statusText, headers: responseHeaders } = result;
  const metadata = { status, statusText, headers: responseHeaders };
  let parsed: T;
  try {
    parsed = (data === '' ? data : JSON.parse(data)) as T;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new ApiError(error.message, { ...metadata, data }, true);
  }

  const parsedResponse = { ...metadata, data: parsed };
  if (!(validateStatus ? validateStatus(status) : status >= 200 && status < 300)) {
    throw new ApiError(`Request failed with status code ${status}`, parsedResponse);
  }
  return parsedResponse;
}

export const api = {
  get<T = unknown>(path: string, options?: ApiOptions): Promise<ApiResponse<T>> {
    return request('GET', path, undefined, options);
  },
  post<T = unknown>(path: string, body?: unknown, options?: ApiOptions): Promise<ApiResponse<T>> {
    return request('POST', path, body, options);
  },
  put<T = unknown>(path: string, body: unknown, options?: ApiOptions): Promise<ApiResponse<T>> {
    return request('PUT', path, body, options);
  },
};
