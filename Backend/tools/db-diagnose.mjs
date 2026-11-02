// Why can't the backend reach Postgres? Read-only, changes nothing, never prints the password.
//   cd Backend
//   node --env-file=.env tools/db-diagnose.mjs
// Steps: 1 DNS  2 TCP to the port  3 TLS + login + SELECT 1  4 server limits  5 who is holding connections.
import dns from "node:dns/promises";
import net from "node:net";
import pg from "pg";

let url;
try {
  url = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.error("DATABASE_URL is missing or not a valid URL (a password with @ # / ? must be URL-encoded).");
  process.exit(1);
}
const host = url.hostname;
const port = Number(url.port || 5432);
console.log(`Target: ${host}:${port}  db=${url.pathname.slice(1)}  user=${decodeURIComponent(url.username)}\n`);

const ms = (t) => `${Math.round(performance.now() - t)} ms`;

// 1. DNS
let t = performance.now();
try {
  const addrs = await dns.lookup(host, { all: true });
  console.log(`1 DNS      OK    ${addrs.map((a) => a.address).join(", ")}  (${ms(t)})`);
  if (addrs.some((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)))
    console.log("           NOTE  private IP: this database is only reachable from inside the AWS VPC (VPN/bastion), not from a home PC.");
} catch (e) {
  console.log(`1 DNS      FAIL  ${e.code} - check the host name in DATABASE_URL, or your internet/DNS.`);
  process.exit(1);
}

// 2. TCP
t = performance.now();
const tcp = await new Promise((resolve) => {
  const s = net.connect({ host, port });
  s.setTimeout(8000);
  s.once("connect", () => (s.destroy(), resolve("OK")));
  s.once("timeout", () => (s.destroy(), resolve("TIMEOUT")));
  s.once("error", (e) => resolve(e.code ?? e.message));
});
console.log(`2 TCP      ${tcp === "OK" ? "OK   " : "FAIL "} ${tcp}  (${ms(t)})`);
if (tcp !== "OK") {
  let ip = "unknown";
  try {
    ip = (await (await fetch("https://checkip.amazonaws.com", { signal: AbortSignal.timeout(5000) })).text()).trim();
  } catch {}
  console.log(`\nYour public IP right now: ${ip}`);
  if (tcp === "TIMEOUT")
    console.log("TIMEOUT = packets are silently dropped. Usual causes, in this order:\n" +
      "  a) RDS security group inbound rule for TCP 5432 does not include your current IP (home/office/hotspot IPs change)\n" +
      "  b) RDS 'Publicly accessible' is No\n" +
      "  c) VPN, college/office firewall or ISP blocks port 5432 (try a phone hotspot)");
  else if (tcp === "ECONNREFUSED") console.log("REFUSED = reached the host but nothing listens on that port: wrong port, or the DB is stopped/rebooting (check RDS status).");
  process.exit(1);
}

// 3. TLS + login + latency
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, application_name: "edurain-diagnose" });
t = performance.now();
try {
  await client.connect();
  console.log(`3 LOGIN    OK    TLS + auth in ${ms(t)}`);
} catch (e) {
  console.log(`3 LOGIN    FAIL  ${e.code ?? ""} ${e.message}`);
  console.log("           password/user wrong, the DB name does not exist, or SSL settings (try ?sslmode=no-verify).");
  process.exit(1);
}
const lat = [];
for (let i = 0; i < 5; i++) {
  const q = performance.now();
  await client.query("SELECT 1");
  lat.push(performance.now() - q);
}
console.log(`           SELECT 1 x5  min ${Math.round(Math.min(...lat))} / avg ${Math.round(lat.reduce((a, b) => a + b) / 5)} / max ${Math.round(Math.max(...lat))} ms` +
  (Math.max(...lat) > 400 ? "   <- slow link: every request needs several queries" : ""));

// 4 + 5. limits and who holds connections
try {
  const max = Number((await client.query("SHOW max_connections")).rows[0].max_connections);
  const rows = (await client.query(
    `SELECT coalesce(nullif(application_name,''),'(none)') AS app, coalesce(client_addr::text,'local') AS from_ip, state, count(*)::int AS n
       FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1,2,3 ORDER BY n DESC LIMIT 12`,
  )).rows;
  const used = rows.reduce((a, r) => a + r.n, 0);
  console.log(`4 LIMITS   max_connections=${max}  in use (this db, top groups)=${used}${used > max * 0.8 ? "   <- almost full" : ""}`);
  console.log("5 HOLDERS");
  console.table(rows);
} catch (e) {
  console.log(`4/5        skipped: ${e.message}`);
}

// 6. anything running or stuck right now (long "secs" or blocked_by > 0 = a query is waiting on a lock)
try {
  const busy = (await client.query(
    `SELECT pid, coalesce(nullif(application_name,''),'(none)') AS app, client_addr::text AS from_ip, state,
            coalesce(wait_event_type || ':' || wait_event, '-') AS waiting_on,
            round(extract(epoch FROM now() - query_start))::int AS secs,
            cardinality(pg_blocking_pids(pid)) AS blocked_by,
            left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 90) AS query
       FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle'
      ORDER BY query_start LIMIT 10`,
  )).rows;
  console.log(`6 RUNNING  ${busy.length ? busy.length + " non-idle session(s)" : "nothing running"}`);
  if (busy.length) console.table(busy);
} catch (e) {
  console.log(`6          skipped: ${e.message}`);
}

// 7. how much the old ticket poller downloaded every 3 s (the newest 60 tickets, full JSON)
try {
  const t = (await client.query(
    `SELECT count(*)::int AS n, coalesce(sum(octet_length(data::text)),0)::bigint AS total, coalesce(max(octet_length(data::text)),0)::bigint AS biggest
       FROM (SELECT data FROM doubt_tickets ORDER BY submitted_at DESC LIMIT 60) x`,
  )).rows[0];
  const mb = (b) => (Number(b) / 1048576).toFixed(1);
  console.log(`7 TICKETS  newest ${t.n} tickets = ${mb(t.total)} MB as JSON (biggest one ${mb(t.biggest)} MB)` +
    (Number(t.total) > 2 * 1048576 ? "   <- heavy: the old poller downloaded this every 3 s" : ""));
} catch (e) {
  console.log(`7          skipped: ${e.message}`);
}
await client.end();
console.log("\nAll steps passed: the database is reachable from this PC. If the backend still times out, send this whole output.");
