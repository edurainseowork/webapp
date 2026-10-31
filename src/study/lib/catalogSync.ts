import { useEffect } from 'react';
import { API_BASE_URL } from './api';

// Shared real-time sync across Web and Expo Mobile App
// Polling /api/sync/versions every ~15s (foreground only, idle pause after 3m). Zero database load.

let syncActive = false;
let syncTimer: any = null;
let currentIntervalSec = 15;
let failureCount = 0;
let lastActiveTime = Date.now();
const localVersions: Record<string, number | string> = {};
const domainListeners = new Map<string, Set<(ver: number | string) => void>>();

// Track user activity for idle pause
if (typeof window !== 'undefined') {
  const markActive = () => {
    const wasIdle = Date.now() - lastActiveTime > 3 * 60_000;
    lastActiveTime = Date.now();
    if (wasIdle && syncActive) {
      void fetchSyncVersions();
    }
  };
  window.addEventListener('mousemove', markActive, { passive: true });
  window.addEventListener('keydown', markActive, { passive: true });
  window.addEventListener('touchstart', markActive, { passive: true });
}

// Client-ID for canary rollouts (persisted in localStorage)
export function getClientId(): string {
  try {
    let cid = localStorage.getItem('edurain:client_id');
    if (!cid) {
      cid = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('edurain:client_id', cid);
    }
    return cid;
  } catch {
    return 'anon';
  }
}

export async function fetchSyncVersions(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return; // Tab hidden -> sleep
  }

  // 3-minute idle pause
  if (Date.now() - lastActiveTime > 3 * 60_000) {
    scheduleNextPoll();
    return;
  }

  try {
    const cid = getClientId();
    // Simple fetch without custom request headers to prevent preflight OPTIONS
    const res = await fetch(`${API_BASE_URL}/api/sync/versions?c=${encodeURIComponent(cid)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      failureCount += 1;
      currentIntervalSec = Math.min(60, 15 * Math.pow(2, failureCount));
      return;
    }

    failureCount = 0;
    const data = await res.json();
    if (!data.enabled) {
      currentIntervalSec = data.next || 300;
      return;
    }

    currentIntervalSec = data.next || 15;
    const v = data.v || {};

    for (const [domain, newVer] of Object.entries(v)) {
      const prevVer = localVersions[domain];
      if (prevVer !== undefined && prevVer !== newVer) {
        // Version changed! Jittered notify (0 to 3000ms; wide spread for notif)
        const spread = domain === 'notif' ? 10_000 : 3_000;
        const jitter = Math.random() * spread;
        setTimeout(() => {
          const listeners = domainListeners.get(domain);
          if (listeners) {
            listeners.forEach((fn) => fn(newVer as number | string));
          }
        }, jitter);
      }
      localVersions[domain] = newVer as number | string;
    }
  } catch {
    failureCount += 1;
    currentIntervalSec = Math.min(60, 15 * Math.pow(2, failureCount));
  } finally {
    scheduleNextPoll();
  }
}

/** Immediately poll sync endpoint (e.g. when X-Sync header changes) */
export function syncNow(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  lastActiveTime = Date.now();
  void fetchSyncVersions();
}

function scheduleNextPoll(): void {
  if (syncTimer) clearTimeout(syncTimer);
  const jitterMs = Math.floor(Math.random() * 2000);
  syncTimer = setTimeout(fetchSyncVersions, currentIntervalSec * 1000 + jitterMs);
}

function startSyncLoopIfNeeded(): void {
  if (syncActive) return;
  syncActive = true;
  void fetchSyncVersions();

  if (typeof window !== 'undefined') {
    const onForeground = () => {
      if (document.visibilityState === 'visible') {
        lastActiveTime = Date.now();
        void fetchSyncVersions();
      }
    };
    window.addEventListener('focus', onForeground);
    document.addEventListener('visibilitychange', onForeground);
  }
}

/**
 * Helper to ensure late/out-of-order responses do not overwrite newer state.
 */
export function latestOnly<T>(load: (signal: AbortSignal) => Promise<T>, apply: (t: T) => void) {
  let seq = 0;
  let ctl: AbortController | null = null;
  return async () => {
    const my = ++seq;
    ctl?.abort();
    ctl = new AbortController();
    try {
      const r = await load(ctl.signal);
      if (my === seq) apply(r);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
    }
  };
}

/**
 * Subscribe to changes for a given sync domain (e.g. 'courses', 'banners', 'categories', 'faqs').
 * Returns unsubscribe callback.
 */
export function onDomainUpdated(domain: string, callback: (ver: number | string) => void): () => void {
  startSyncLoopIfNeeded();
  let set = domainListeners.get(domain);
  if (!set) {
    set = new Set();
    domainListeners.set(domain, set);
  }
  set.add(callback);

  return () => {
    set?.delete(callback);
  };
}

/** Legacy socket/catalog compatibility hook: points to sync loop with optional domain filter */
export function onCatalogUpdated(listener: (version: number) => void, domains?: string[]): () => void {
  const targetDomains = domains && domains.length > 0 ? domains : ['courses', 'categories'];
  const unsubs = targetDomains.map((d) =>
    onDomainUpdated(d, (v) => listener(typeof v === 'number' ? v : Date.now()))
  );
  return () => unsubs.forEach((u) => u());
}

/**
 * Hook to auto-refresh state when domain data changes in CMS (without manual reload).
 */
export function useCatalogRefresh(load: () => void, domain = 'courses') {
  useEffect(() => {
    load();
    const unsub = onDomainUpdated(domain, () => {
      load();
    });
    return unsub;
  }, [load, domain]);
}
