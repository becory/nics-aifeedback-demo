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

const NO_REFRESH_RETRY_PATHS = ["/auth/login", "/auth/2fa", "/auth/refresh"];

instance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

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
    try {
      refreshPromise ??= handler().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return instance(originalRequest);
    } catch (refreshError) {
      onUnauthorized?.();
      throw refreshError;
    }
  },
);