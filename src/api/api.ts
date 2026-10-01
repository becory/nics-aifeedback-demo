import axios from "axios";

export const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 5000,
  withCredentials: true
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
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

// Refresh tokens rotate (each one is single-use), so concurrent 401s must share one refresh.
let refreshPromise: Promise<void> | null = null;

function sharedRefresh(handler: RefreshHandler): Promise<void> {
  refreshPromise ??= handler().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

instance.interceptors.request.use(async (config) => {
  // A request sent while a refresh is in flight would carry the expiring token and come back
  // 401 after the refresh finished, starting another one. Wait and send the new token instead.
  // (Auth calls skip this: the refresh itself calls /auth/me, which would wait on its own refresh.)
  if (refreshPromise && !isAuthPath(config.url)) {
    try {
      await refreshPromise;
    } catch {
      // The refresh failed; the request goes out unauthenticated and its 401 is handled below.
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
