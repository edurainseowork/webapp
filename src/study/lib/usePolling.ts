import { useEffect, useRef } from 'react';

/**
 * Calls `load` now, then at most once per `everyMs`, and only while the tab is visible: on a timer and
 * when the window or tab is shown again. Window focus and tab visibility fire together, which used to
 * double every call, and every alt-tab started a new burst of requests.
 * `restartKey` starts the polling over when it changes (for example a different user).
 */
export function usePolling(load: () => void, everyMs: number, restartKey?: unknown) {
  const latest = useRef(load);
  latest.current = load;
  const last = useRef(0);
  const key = useRef(restartKey);
  useEffect(() => {
    if (key.current !== restartKey) {
      key.current = restartKey;
      last.current = 0;
    }
    const run = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current < everyMs * 0.9) return;
      last.current = Date.now();
      latest.current();
    };
    run();
    const timer = setInterval(run, everyMs);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
    };
  }, [everyMs, restartKey]);
}
