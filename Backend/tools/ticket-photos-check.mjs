// Read-only. Are the photos of the newest tickets really in the database? Prints sizes, never the photos themselves.
//   cd Backend
//   node --env-file=.env tools/ticket-photos-check.mjs            newest 15 tickets
//   node --env-file=.env tools/ticket-photos-check.mjs TKT-1100   one ticket
// Where a photo lives: the ticket row (doubt_tickets.data) keeps a short marker "edurain-blob:<32 hex>",
// the photo itself is one row in ticket_blobs. "MISSING" below would mean the marker has no photo behind it.
import pg from "pg";

const arg = process.argv[2];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 20000 });
try {
  const { rows } = arg
    ? await pool.query("SELECT ticket_number, data::text AS t FROM doubt_tickets WHERE upper(ticket_number) = upper($1)", [arg])
    : await pool.query("SELECT ticket_number, data::text AS t FROM doubt_tickets ORDER BY submitted_at DESC LIMIT 15");
  if (!rows.length) { console.log(arg ? `No ticket ${arg}` : "No tickets"); process.exit(0); }
  const markers = (t) => [...new Set(t.match(/edurain-blob:[0-9a-f]{32}/g) ?? [])];
  const all = [...new Set(rows.flatMap((r) => markers(r.t)))];
  const hasTable = (await pool.query("SELECT to_regclass('ticket_blobs') IS NOT NULL AS t")).rows[0].t;
  const have = new Map(hasTable && all.length ? (await pool.query("SELECT id, octet_length(content) AS n FROM ticket_blobs WHERE id = ANY($1)", [all])).rows.map((b) => [b.id, Number(b.n)]) : []);
  const out = rows.map((r) => {
    const m = markers(r.t);
    return {
      ticket: r.ticket_number,
      rowKB: Math.round(Buffer.byteLength(r.t) / 1024),
      photos: m.length,
      photosMB: (m.reduce((a, id) => a + (have.get(id) ?? 0), 0) / 1048576).toFixed(2),
      MISSING: m.filter((id) => !have.has(id)).length,
      inlineBig: (r.t.match(/"[^"]{50001,}"/g) ?? []).length, // photos still stored inside the ticket (not moved yet)
    };
  });
  console.table(out);
  if (hasTable) {
    const { rows: [b] } = await pool.query("SELECT count(*)::int AS n, coalesce(sum(octet_length(content)),0)::bigint AS bytes FROM ticket_blobs");
    console.log(`ticket_blobs table: ${b.n} photos, ${(Number(b.bytes) / 1048576).toFixed(2)} MB in total`);
  } else {
    console.log("ticket_blobs table does not exist yet (no photo has been moved there).");
  }
  console.log(out.some((o) => o.MISSING) ? "PROBLEM: some markers have no photo in ticket_blobs (send this output to Claude)." : "OK: every marker has its photo in the database.");
} catch (e) {
  console.error("Could not check:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
