import type { RequestHandler } from "express";
import { getIO } from "../socket.js";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Mount in front of a CMS router. After any successful write (its cache is already cleared by the
 * handler before it replies) every connected student app gets "catalog_updated" and refetches.
 */
export const broadcastCatalogChange: RequestHandler = (req, res, next) => {
  if (WRITES.has(req.method)) {
    res.on("finish", () => {
      const io = getIO();
      if (!io || res.statusCode >= 400) return;
      // Students refetch after a random delay so 50k of them do not hit the API in the same second
      io.emit("catalog_updated", { at: Date.now(), jitterMs: Math.min(10_000, io.engine.clientsCount * 0.2) });
    });
  }
  next();
};
