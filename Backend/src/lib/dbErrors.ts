// True when Postgres could not be reached (network, restart, no free connection), as opposed to a bug in a query.
// drizzle wraps the driver error in `cause`, so walk the chain.
const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);
// 08xxx connection exception, 57P01-57P03 server shutting down / not accepting, 53300 too many connections
const PG_CODE = /^(08|57P0[1-3]|53300)/;
const PG_MESSAGE = /timeout exceeded when trying to connect|Connection terminated|connection error/i;

export function isDbUnavailable(err: unknown): boolean {
  let e = err as { code?: unknown; message?: unknown; cause?: unknown } | undefined;
  for (let i = 0; e && typeof e === "object" && i < 5; i++, e = e.cause as typeof e) {
    if (typeof e.code === "string" && (NETWORK_CODES.has(e.code) || PG_CODE.test(e.code))) return true;
    if (PG_MESSAGE.test(String(e.message ?? ""))) return true;
  }
  return false;
}
