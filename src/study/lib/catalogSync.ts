import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

// One shared socket for the whole app. The server emits 'catalog_updated' whenever the CMS saves a
// course, category, banner or FAQ; listeners refetch. Pollers slow down while the socket is live and
// carry the load alone when it is not (e.g. a Lambda backend has no sockets).
let socket: Socket | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(version: number) => void>();

// One refetch for a burst of saves (and after a reconnect, which may have missed some).
// The server sends jitterMs (grows with the number of connected students) to spread the refetches.
const notify = (version: number, jitterMs = 0) => {
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach((listener) => listener(version)), 300 + Math.random() * jitterMs);
};

/** True while the push channel is connected. */
export const catalogLive = () => !!socket?.connected;

/**
 * Calls `listener` whenever the CMS changes something. `version` is the same number for every student
 * (the save time), so a URL like /courses?v=<version> is fetched once by a CDN and shared by everyone.
 * Returns the unsubscribe function.
 */
export function onCatalogUpdated(listener: (version: number) => void): () => void {
  listeners.add(listener);
  if (!socket) {
    // websocket only and a few retries: a backend without sockets must not be hammered with handshakes
    socket = io(API_BASE_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
    socket.on('catalog_updated', (payload?: { at?: number; jitterMs?: number }) => notify(payload?.at ?? Date.now(), payload?.jitterMs));
    // A reconnect may have missed saves; the per-minute number keeps the URL shared between students
    socket.io.on('reconnect', () => notify(Math.floor(Date.now() / 60_000), 5_000));
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      socket?.disconnect();
      socket = null;
    }
  };
}

/**
 * Keeps `load` fresh: runs it now, whenever the CMS pushes a change, when the tab comes back into view,
 * and on a safety-net timer (every 5 min while push is live, every 30s when it is not).
 */
export function useCatalogRefresh(load: () => void) {
  useEffect(() => {
    let last = 0;
    const run = () => {
      last = Date.now();
      load();
    };
    const due = (waitMs: number) => document.visibilityState === 'visible' && Date.now() - last >= waitMs;
    run();
    const tick = setInterval(() => {
      if (due(catalogLive() ? 300_000 : 30_000)) run();
    }, 30_000);
    const onView = () => {
      if (due(10_000)) run();
    };
    window.addEventListener('focus', onView);
    document.addEventListener('visibilitychange', onView);
    const off = onCatalogUpdated(run);
    return () => {
      clearInterval(tick);
      window.removeEventListener('focus', onView);
      document.removeEventListener('visibilitychange', onView);
      off();
    };
  }, [load]);
}
