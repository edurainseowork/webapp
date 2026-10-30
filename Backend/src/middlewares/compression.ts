/**
 * ============================================================================
 * MULTI-TIER ADAPTIVE HTTP COMPRESSION ENGINE (ZSTD ➔ BROTLI ➔ GZIP)
 * ============================================================================
 * Native Node.js 24 Standard Library Implementation (`node:zlib`).
 * Zero external npm dependencies.
 *
 * Algorithm Priority (as recommended by production performance experts):
 * 1. Zstandard (`zstd`)  — Highest compression ratio & fastest decompression speed.
 * 2. Brotli    (`br`)    — Google standard for web assets, ~20% smaller than Gzip.
 * 3. Gzip      (`gzip`)  — Universal legacy fallback.
 * 4. Identity  (`plain`) — If client does not support compression or payload < 1KB.
 *
 * Performance Safeguards:
 * - Skips tiny payloads (< 1,024 bytes) to avoid negative compression expansion.
 * - Skips already compressed MIME types (JPEG, PNG, WebP, AVIF, MP4, PDF, ZIP).
 * - Adapts compression level based on payload size (fast levels for small payloads, balanced for large).
 * - Graceful fallback to uncompressed stream if compression encounters any error.
 */

import type { Request, Response, NextFunction } from "express";
import * as zlib from "node:zlib";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

// zstd only exists in Node 22.15+. Lambda's nodejs20.x has no such export, and a named import of a missing export
// stops the whole app at start (API Gateway then answers "Internal Server Error" to everything). The typeof check
// below turns zstd off when it is missing.
const zstdCompressSync = (zlib as unknown as { zstdCompressSync: (buf: Buffer) => Buffer }).zstdCompressSync;

// MIME types that are already compressed at binary level — compressing them wastes CPU
const ALREADY_COMPRESSED_REGEX =
  /^image\/(jpeg|png|webp|avif|gif)|video\/|audio\/|application\/(zip|gzip|x-rar|pdf|x-7z-compressed)/i;

// Text-based MIME types that benefit dramatically from compression (up to 90% reduction)
const COMPRESSIBLE_REGEX =
  /^text\/|^application\/(json|javascript|xml|wasm|ld\+json)|image\/svg\+xml/i;

const MIN_COMPRESSION_SIZE = 1024; // 1 KB threshold

export function adaptiveCompression() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Fast path: client doesn't accept compression or HEAD request
    if (req.method === "HEAD") return next();

    const acceptEncoding = (req.headers["accept-encoding"] as string) || "";
    if (!acceptEncoding) return next();

    // Determine highest supported encoding in order of efficiency: zstd > br > gzip
    const supportsZstd = /\bzstd\b/i.test(acceptEncoding) && typeof zstdCompressSync === "function";
    const supportsBrotli = /\bbr\b/i.test(acceptEncoding) && typeof brotliCompressSync === "function";
    const supportsGzip = /\bgzip\b/i.test(acceptEncoding) && typeof gzipSync === "function";

    if (!supportsZstd && !supportsBrotli && !supportsGzip) {
      return next();
    }

    // Always signal caching proxies that the response varies by Accept-Encoding
    res.setHeader("Vary", "Accept-Encoding");

    // Intercept res.send / res.json
    const originalSend = res.send.bind(res);

    res.send = function (body?: any): Response {
      // If headers already sent or response has error status >= 500, skip compression
      if (res.headersSent || res.statusCode >= 500 || body === undefined || body === null) {
        return originalSend(body);
      }

      // If already encoded by another middleware (e.g. static server), skip
      if (res.getHeader("Content-Encoding")) {
        return originalSend(body);
      }

      // Check MIME type
      const contentType = String(res.getHeader("Content-Type") || "");
      if (contentType && ALREADY_COMPRESSED_REGEX.test(contentType)) {
        return originalSend(body);
      }

      // Convert body to Buffer
      let chunk: Buffer;
      if (Buffer.isBuffer(body)) {
        chunk = body;
      } else if (typeof body === "string") {
        chunk = Buffer.from(body);
      } else if (typeof body === "object") {
        chunk = Buffer.from(JSON.stringify(body));
        if (!res.getHeader("Content-Type")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
      } else {
        chunk = Buffer.from(String(body));
      }

      // Skip tiny responses (< 1KB) to prevent negative compression overhead
      if (chunk.length < MIN_COMPRESSION_SIZE) {
        return originalSend(chunk);
      }

      try {
        let compressed: Buffer;
        let selectedEncoding: "zstd" | "br" | "gzip";

        if (supportsZstd) {
          selectedEncoding = "zstd";
          // Node 24 native Zstandard compression
          compressed = zstdCompressSync(chunk);
        } else if (supportsBrotli) {
          selectedEncoding = "br";
          // Node 24 native Brotli with quality tuned to payload size (4 for fast, 6 for >50KB)
          const quality = chunk.length > 50_000 ? 6 : 4;
          compressed = brotliCompressSync(chunk, {
            params: {
              [zlibConstants.BROTLI_PARAM_QUALITY]: quality,
            },
          });
        } else {
          selectedEncoding = "gzip";
          // Node 24 native Gzip level 6 (standard balance of speed & ratio)
          compressed = gzipSync(chunk, { level: 6 });
        }

        // Only send compressed if it actually reduced the payload size
        if (compressed.length < chunk.length) {
          res.setHeader("Content-Encoding", selectedEncoding);
          res.setHeader("Content-Length", compressed.length);
          res.removeHeader("ETag"); // Raw ETag no longer matches compressed payload
          return originalSend(compressed);
        }
      } catch (err) {
        // Safe graceful degradation: on any compression fault, fall back to plain chunk
      }

      return originalSend(chunk);
    };

    next();
  };
}

