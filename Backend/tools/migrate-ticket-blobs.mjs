// Moves big attachments out of doubt_tickets.data into ticket_blobs (see src/lib/ticketBlobs.ts), so a ticket
// list, a sync and a Lambda cold start stop downloading tens of MB.
//   cd Backend
//   node --env-file=.env tools/migrate-ticket-blobs.mjs            only looks: shows what would shrink
//   node --env-file=.env tools/migrate-ticket-blobs.mjs --apply    does it
// Run it AFTER every server that reads tickets runs the new code (an old server would show the markers as text).
// Safe to run again. Nothing is deleted: each attachment is written to ticket_blobs first, a ticket is only
// changed if nobody edited it meanwhile (that one is skipped: just run again), and every change is read back and checked.
import pg from "pg";
import { build } from "esbuild";

const apply = process.argv.includes("--apply");
const { outputFiles } = await build({ entryPoints: ["src/lib/ticketBlobs.ts"], bundle: true, format: "esm", platform: "node", write: false });
const { externalize, inflate, BLOB_MIN } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 20000 });
const mb = (n) => (Number(n) / 1048576).toFixed(2);

try {
  const { rows: sizes } = await pool.query("SELECT id, ticket_number, octet_length(data::text) AS n FROM doubt_tickets ORDER BY n DESC");
  const total = sizes.reduce((a, r) => a + Number(r.n), 0);
  const big = sizes.filter((r) => r.n > BLOB_MIN);
  console.log(`${sizes.length} tickets, ${mb(total)} MB as JSON. ${big.length} are bigger than ${BLOB_MIN / 1000} KB.`);
  if (!big.length) {
    console.log("Nothing to do.");
  } else if (!apply) {
    console.table(big.slice(0, 10).map((r) => ({ ticket: r.ticket_number, MB: mb(r.n) })));
    console.log("Looked only. Run again with --apply to move their attachments out.");
  } else {
    await pool.query("CREATE TABLE IF NOT EXISTS ticket_blobs (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const store = {
      put: async (id, content) => void (await pool.query("INSERT INTO ticket_blobs (id, content) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [id, content])),
      get: async (ids) => new Map((await pool.query("SELECT id, content FROM ticket_blobs WHERE id = ANY($1)", [ids])).rows.map((r) => [r.id, r.content])),
    };
    let moved = 0, skipped = 0;
    for (const { id, ticket_number: num } of big) {
      const { rows: [row] } = await pool.query("SELECT data, updated_at::text AS ver FROM doubt_tickets WHERE id = $1", [id]);
      const light = await externalize(row.data, store);
      // only if nobody changed the ticket since we read it (updated_at moves on every save)
      const res = await pool.query("UPDATE doubt_tickets SET data = $1 WHERE id = $2 AND updated_at::text = $3", [JSON.stringify(light), id, row.ver]);
      if (res.rowCount !== 1) { skipped++; console.log(`  ${num}: changed while migrating, skipped (run again)`); continue; }
      const { rows: [after] } = await pool.query("SELECT data FROM doubt_tickets WHERE id = $1", [id]);
      if (JSON.stringify(await inflate(after.data, store)) !== JSON.stringify(row.data)) {
        throw new Error(`${num}: read-back does not match the original. The original attachments are still in ticket_blobs; stop and send this message to Claude.`);
      }
      moved++;
      console.log(`  ${num}: ${mb(JSON.stringify(row.data).length)} MB -> ${(JSON.stringify(light).length / 1024).toFixed(1)} KB`);
    }
    const { rows: [now] } = await pool.query("SELECT sum(octet_length(data::text)) AS n FROM doubt_tickets");
    console.log(`Done: ${moved} migrated, ${skipped} skipped. Tickets are now ${mb(now.n)} MB as JSON (was ${mb(total)} MB).`);
  }
} finally {
  await pool.end();
}
