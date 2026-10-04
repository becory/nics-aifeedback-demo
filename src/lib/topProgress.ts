import { getPendingRequestCount, subscribePendingRequests } from "../api/api";

// Most requests finish before this, so the bar doesn't flash on every click.
const SHOW_DELAY_MS = 300;
// Real progress is unknowable (the time is spent waiting on the server), so the bar jumps to
// START, then creeps toward CAP ever more slowly, and only reaches 100% when everything is done.
const START = 0.3;
const CAP = 0.9;
const TRICKLE_MS = 300;
const TRICKLE_RATE = 0.1; // share of the remaining distance to CAP covered per tick
// Must match the CSS transitions on .cf-top-progress (opacity) and its bar (transform).
const FILL_MS = 200;
const FADE_MS = 300;

type ProgressElement = Pick<HTMLElement, "style" | "classList" | "offsetWidth">;

/**
 * Drives the bar straight on the DOM: it changes several times a second and nothing else reads
 * it, so there's no reason to re-render React for it. Returns the cleanup.
 */
export function attachTopProgress(wrap: ProgressElement, bar: ProgressElement): () => void {
  let progress = 0;
  let visible = false;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let trickleTimer: ReturnType<typeof setInterval> | undefined;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const setProgress = (p: number) => {
    progress = p;
    bar.style.transform = `scaleX(${p})`;
  };

  const run = () => {
    clearTimeout(fadeTimer);
    clearTimeout(hideTimer);
    visible = true;
    wrap.classList.add("cf-top-progress--visible");
    // Picking up again while the last run was finishing: carry on from (just under) there.
    setProgress(progress === 0 ? START : Math.min(progress, CAP));
    clearInterval(trickleTimer);
    trickleTimer = setInterval(() => setProgress(progress + (CAP - progress) * TRICKLE_RATE), TRICKLE_MS);
  };

  const finish = () => {
    clearInterval(trickleTimer);
    trickleTimer = undefined;
    setProgress(1);
    fadeTimer = setTimeout(() => {
      wrap.classList.remove("cf-top-progress--visible");
      hideTimer = setTimeout(() => {
        visible = false;
        // Back to 0 without animating, ready for the next run.
        bar.style.transition = "none";
        setProgress(0);
        void bar.offsetWidth;
        bar.style.transition = "";
      }, FADE_MS);
    }, FILL_MS);
  };

  const onChange = () => {
    const busy = getPendingRequestCount() > 0;
    if (busy) {
      if (visible) {
        if (!trickleTimer) run();
      } else if (!showTimer) {
        showTimer = setTimeout(() => {
          showTimer = undefined;
          if (getPendingRequestCount() > 0) run();
        }, SHOW_DELAY_MS);
      }
    } else {
      clearTimeout(showTimer);
      showTimer = undefined;
      if (trickleTimer) finish();
    }
  };

  const unsubscribe = subscribePendingRequests(onChange);
  onChange();
  return () => {
    unsubscribe();
    clearTimeout(showTimer);
    clearInterval(trickleTimer);
    clearTimeout(fadeTimer);
    clearTimeout(hideTimer);
  };
}
