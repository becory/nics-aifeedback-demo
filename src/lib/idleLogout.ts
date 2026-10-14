import { useEffect, useRef } from "react";

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// The server's refresh token also expires after 30 minutes without a refresh, so while the user
// is active (even without triggering any API call) the session is renewed about once a minute.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"] as const;

export function useIdleLogout(active: boolean, onIdle: () => void, keepAlive: () => Promise<void>) {
  const lastActivity = useRef(0);
  const lastKeepAlive = useRef(0);

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    lastKeepAlive.current = Date.now();

    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActivity.current >= IDLE_TIMEOUT_MS) {
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
