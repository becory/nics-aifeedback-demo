import axios from "axios";

export const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 5000,
  withCredentials: true
});

let accessToken: string | null = null;
// Local clock time (ms) the access token expires, from the API's expiresIn — counted from when
// we received it rather than from the JWT's exp, so a wrong client clock can't skew it.
let accessTokenExpiresAt: number | null = null;

/** expiresInSeconds comes with every token response; without it there's no early refresh. */
export function setAccessToken(token: string | null, expiresInSeconds?: number) {
  // The same token re-synced from React state keeps the expiry recorded when it arrived.
  if (token === accessToken && expiresInSeconds === undefined) return;
  accessToken = token;
  accessTokenExpiresAt = token && expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null;
}

type RefreshHandler = () => Promise<void>;

let refreshHandler: RefreshHandler | null = null;
let onUnauthorized: (() => void) | null = null;

export function setRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler;
}

export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// Repeats a key once per array element (?eventType=a&eventType=b), which is how the backend's
// multi-value filters bind; axios' default would send eventType[]=a instead.
export function serializeRepeatedParams(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== null) usp.append(key, String(v));
      }
    } else {
      usp.append(key, String(value));
    }
  }
  return usp.toString();
}

export function getApiErrorMessage(error: unknown): string | undefined {
  if (axios.isAxiosError(error) && typeof error.response?.data === "string") {
    return error.response.data;
  }
  return undefined;
}

// Auth calls never trigger a refresh. /auth/me is only called right after a token was issued
// (including inside the refresh itself, where waiting on the refresh would deadlock).
const NO_REFRESH_RETRY_PATHS = ["/auth/login", "/auth/2fa", "/auth/refresh", "/auth/me"];

const isAuthPath = (url?: string) => !!url?.startsWith("/auth/");

// Refresh tokens rotate (each one is single-use), so every refresh — early or after a 401 —
// goes through this one shared promise.
let refreshPromise: Promise<void> | null = null;

function sharedRefresh(handler: RefreshHandler): Promise<void> {
  refreshPromise ??= handler().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// Refresh this long before expiry, so a request never goes out with a token about to lapse.
// Only requests trigger it: an idle tab doesn't renew its session on its own.
const EARLY_REFRESH_MS = 60_000;

const tokenExpiringSoon = () =>
  !!accessToken && accessTokenExpiresAt !== null && accessTokenExpiresAt - Date.now() < EARLY_REFRESH_MS;

instance.interceptors.request.use(async (config) => {
  // Auth calls skip this: the refresh itself calls /auth/me, which would wait on its own refresh.
  if (!isAuthPath(config.url)) {
    const handler = refreshHandler;
    if (!refreshPromise && handler && tokenExpiringSoon()) sharedRefresh(handler);
    // Also covers a refresh started by another request's 401: without waiting, this request
    // would carry the old token and come back 401 after the refresh finished.
    if (refreshPromise) {
      try {
        await refreshPromise;
      } catch {
        // The refresh failed. The request goes out with whatever token there is; a 401 is
        // handled below (and logs out only if refreshing fails again).
      }
    }
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const handler = refreshHandler;
    const isAuthEndpoint = NO_REFRESH_RETRY_PATHS.some((path) =>
      originalRequest?.url?.includes(path),
    );

    if (
      error.response?.status !== 401 ||
      !handler ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint
    ) {
      throw error;
    }

    originalRequest._retry = true;

    // The token was already refreshed after this request went out: just resend it, rather than
    // spending another (rotating) refresh token.
    const sentWith = originalRequest.headers?.Authorization;
    if (accessToken && sentWith && sentWith !== `Bearer ${accessToken}`) {
      return instance(originalRequest);
    }

    try {
      await sharedRefresh(handler);
      return instance(originalRequest);
    } catch (refreshError) {
      onUnauthorized?.();
      throw refreshError;
    }
  },
);
