import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// The short intro video the mobile app shows once to a student after they log in.
// One row (id = 1). The video lives in Bunny Stream; the app plays its HLS stream.

export interface AppIntroVideo {
  videoId: string;
  title: string | null;
  hlsUrl: string;
  playerUrl: string;
  thumbnailUrl: string;
  durationSec: number | null;
  updatedAt: string;
}

let ready: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  return (ready ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS app_intro_video (
            id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            video_id text NOT NULL,
            title text,
            duration_sec integer,
            updated_at timestamptz NOT NULL DEFAULT now())`,
    )
    .then(() => undefined)
    .catch((err) => {
      ready = null;
      throw err;
    }));
}

export const bunnyConfig = () => ({
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID || "775402",
  apiKey: process.env.BUNNY_STREAM_API_KEY,
  cdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME || "vz-0167fe79-908.b-cdn.net",
});

const toVideo = (row: any): AppIntroVideo => {
  const { libraryId, cdnHostname } = bunnyConfig();
  return {
    videoId: row.video_id,
    title: row.title ?? null,
    hlsUrl: `https://${cdnHostname}/${row.video_id}/playlist.m3u8`,
    playerUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${row.video_id}`,
    thumbnailUrl: `https://${cdnHostname}/${row.video_id}/thumbnail.jpg`,
    durationSec: row.duration_sec ?? null,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export async function getIntroVideo(): Promise<AppIntroVideo | null> {
  await ensureSchema();
  const { rows } = await db.execute(sql`SELECT * FROM app_intro_video WHERE id = 1`);
  return rows[0] ? toVideo(rows[0]) : null;
}

/** Bunny's status for a video: whether it finished encoding, and its length. Null when Bunny cannot be asked. */
export async function bunnyVideoInfo(videoId: string): Promise<{ ready: boolean; lengthSec: number | null } | null> {
  const { libraryId, apiKey } = bunnyConfig();
  if (!apiKey) return null;
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${encodeURIComponent(videoId)}`, {
    headers: { AccessKey: apiKey, Accept: "application/json" },
  });
  if (res.status === 404) return { ready: false, lengthSec: null };
  if (!res.ok) return null;
  const v: any = await res.json().catch(() => ({}));
  // Bunny status 4 = finished, 3 = transcoding but already playable
  return { ready: v.status === 4 || v.status === 3, lengthSec: typeof v.length === "number" && v.length > 0 ? v.length : null };
}

export async function setIntroVideo(videoId: string, title: string | null, durationSec: number | null): Promise<AppIntroVideo> {
  await ensureSchema();
  const { rows } = await db.execute(sql`
    INSERT INTO app_intro_video (id, video_id, title, duration_sec, updated_at)
    VALUES (1, ${videoId}, ${title}, ${durationSec}, now())
    ON CONFLICT (id) DO UPDATE SET video_id = EXCLUDED.video_id, title = EXCLUDED.title,
      duration_sec = EXCLUDED.duration_sec, updated_at = now()
    RETURNING *`);
  return toVideo(rows[0]);
}

export async function clearIntroVideo(): Promise<void> {
  await ensureSchema();
  await db.execute(sql`DELETE FROM app_intro_video WHERE id = 1`);
}
