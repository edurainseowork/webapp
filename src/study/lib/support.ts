import { useEffect, useState } from 'react';
import { apiFetch } from './api';

// Support phone numbers set in CMS → Support Contacts (GET /api/support-contacts, no login needed).
// Loaded once and shared by every screen that shows them; refreshed when older than a minute.

export interface SupportContact {
  id: number;
  label: string;
  /** Digits with an optional leading +, e.g. "+919876543210" or "18001234567" */
  phone: string;
  whatsapp: boolean;
  sortOrder: number;
}

type State = { status: 'loading' | 'ready' | 'error'; contacts: SupportContact[] };

let state: State = { status: 'loading', contacts: [] };
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: State) => void>();

function load(): Promise<void> {
  inflight ??= apiFetch<{ data?: SupportContact[] }>('/support-contacts')
    .then((res) => {
      state = { status: 'ready', contacts: Array.isArray(res.data) ? res.data : [] };
      loadedAt = Date.now();
    })
    .catch(() => {
      // Keep the last good list; only report an error when there is nothing to show
      if (state.status !== 'ready') state = { status: 'error', contacts: [] };
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((l) => l(state));
    });
  return inflight;
}

/** The support numbers from the CMS, lowest sort order first. */
export function useSupportContacts(): State & { reload: () => void } {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    if (Date.now() - loadedAt > 60_000) void load();
    else setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return { ...current, reload: () => void load() };
}

/** "+919876543210" → "+91 98765 43210", "9876543210" → "98765 43210"; anything else unchanged. */
export function formatSupportPhone(phone: string): string {
  const m = phone.match(/^(\+91)?([6-9]\d{4})(\d{5})$/);
  if (m) return `${m[1] ? '+91 ' : ''}${m[2]} ${m[3]}`;
  const tollFree = phone.match(/^(1800)(\d{3})(\d{4})$/);
  if (tollFree) return `${tollFree[1]} ${tollFree[2]} ${tollFree[3]}`;
  return phone;
}

export const telHref = (phone: string) => `tel:${phone}`;

/** wa.me needs the country code without "+"; plain 10-digit numbers are Indian. */
export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}