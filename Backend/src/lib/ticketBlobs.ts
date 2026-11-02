import { createHash } from "node:crypto";

// Attachments arrive as base64 data URLs inside the ticket JSON (one ticket reached 8 MB; 24 tickets were 30 MB).
// Kept inline, every ticket list, sync and Lambda cold start downloaded all of it. So any string longer than
// BLOB_MIN moves to its own table and the ticket keeps a short marker. BLOB_MIN is the size the list view already
// treats as "too big to show".
export const BLOB_MIN = 50_000;
const PREFIX = "edurain-blob:";
const MARKER = /^edurain-blob:[0-9a-f]{32}$/;
const isMarker = (s: string) => s.length === PREFIX.length + 32 && MARKER.test(s);

export interface BlobStore {
  put(id: string, content: string): Promise<void>;
  get(ids: string[]): Promise<Map<string, string>>;
}

function mapStrings(v: unknown, fn: (s: string) => string): any {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn)]));
  return v;
}

/** A copy of `value` with every big string swapped for a marker; the text goes to `store`. Same text, same marker. */
export async function externalize<T>(value: T, store: BlobStore): Promise<T> {
  const found = new Map<string, string>();
  const out = mapStrings(value, (s) => {
    if (s.length <= BLOB_MIN) return s;
    const id = PREFIX + createHash("sha256").update(s).digest("hex").slice(0, 32);
    found.set(id, s);
    return id;
  });
  await Promise.all([...found].map(([id, s]) => store.put(id, s)));
  return out;
}

export function hasBlobs(value: unknown): boolean {
  let hit = false;
  mapStrings(value, (s) => ((hit ||= isMarker(s)), s));
  return hit;
}

/** A copy of `value` with markers swapped back for the stored text. A marker whose text is missing is left as it is. */
export async function inflate<T>(value: T, store: BlobStore): Promise<T> {
  const ids = new Set<string>();
  mapStrings(value, (s) => (isMarker(s) && ids.add(s), s));
  if (!ids.size) return value;
  const blobs = await store.get([...ids]);
  return mapStrings(value, (s) => (isMarker(s) ? (blobs.get(s) ?? s) : s));
}

/** List views carry no attachments: a marker becomes the "[attachment]" text the list already shows for big ones. */
export const stripBlobs = <T>(value: T): T => mapStrings(value, (s) => (isMarker(s) ? "[attachment]" : s));
