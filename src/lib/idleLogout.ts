import { useEffect, useRef } from "react";

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// The server's refresh token also expires after 30 minutes without a refresh, so while the user
// is active (even without triggering any API call) the session is renewed about once a minute.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_STORAGE_KEY = "aifeedback.lastActivity";
const STORAGE_WRITE_THROTTLE_MS = 5 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"] as const;

const readSharedActivity = (): number => {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeSharedActivity = (time: number) => {
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(time));
  } catch {
    // Storage unavailable: fall back to per-tab idle detection.
  }
};

// Idle is judged on activity in any tab (the logout revokes the shared refresh cookie, so an idle
// background tab must not log out a tab in use). Keep-alive uses only this tab's own activity, so
// just the tab being used refreshes and tabs don't race the single-use refresh token.
export function useIdleLogout(active: boolean, onIdle: () => void, keepAlive: () => Promise<void>) {
  const lastActivity = useRef(0);
  const lastKeepAlive = useRef(0);

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    lastKeepAlive.current = Date.now();
    let lastWrite = 0;
    writeSharedActivity(lastActivity.current);

    const onActivity = () => {
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastWrite >= STORAGE_WRITE_THROTTLE_MS) {
        lastWrite = now;
        writeSharedActivity(now);
      }
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - Math.max(lastActivity.current, readSharedActivity()) >= IDLE_TIMEOUT_MS) {
        onIdle();
        return;
      }
      if (lastActivity.current > lastKeepAlive.current && now - lastKeepAlive.current >= KEEP_ALIVE_INTERVAL_MS) {
        lastKeepAlive.current = now;
        keepAlive().catch(() => {});
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      window.clearInterval(timer);
    };
  }, [active, onIdle, keepAlive]);
}
