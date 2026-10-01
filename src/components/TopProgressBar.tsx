import { useEffect, useRef } from "react";
import { attachTopProgress } from "../lib/topProgress";

/** Thin bar across the top of the page while any API request is in flight. Never blocks input. */
export function TopProgressBar() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => attachTopProgress(wrapRef.current!, barRef.current!), []);

  return (
    <div ref={wrapRef} className="cf-top-progress" aria-hidden>
      <div ref={barRef} className="cf-top-progress__bar" />
    </div>
  );
}
