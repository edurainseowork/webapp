/**
 * ============================================================================
 * PRODUCTION API PAGINATION GUARD
 * ============================================================================
 * Prevents memory exhaustion, database connection clogging, and excessive
 * egress bandwidth caused by unbounded SELECT queries.
 *
 * Provides:
 * 1. Safe parameter sanitization (clamped limits: min 1, default 20, max 100).
 * 2. Standardized HTTP pagination headers (`X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`, `X-Has-More`).
 * 3. Backward-compatible payload formatting:
 *    - If client calls `?paginated=true` or specifies `?page=...`/`?limit=...`, returns:
 *        `{ data: [...], pagination: { page, limit, total, totalPages, hasMore } }`
 *    - If client does not specify pagination parameters, returns the array as-is
 *      while still injecting HTTP pagination headers so legacy clients don't break!
 */

import type { Request, Response } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  isExplicitPagination: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function parsePagination(
  req: Request,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const rawPage = req.query.page;
  const rawLimit = req.query.limit;
  const hasPageParam = rawPage !== undefined && rawPage !== null && rawPage !== "";
  const hasLimitParam = rawLimit !== undefined && rawLimit !== null && rawLimit !== "";
  const isExplicit = hasPageParam || hasLimitParam || req.query.paginated === "true";

  let page = Number.parseInt(String(rawPage || "1"), 10);
  if (Number.isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = Number.parseInt(String(rawLimit || defaultLimit), 10);
  if (Number.isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit; // Hard protection against ?limit=999999 attacks
  }

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    isExplicitPagination: isExplicit,
  };
}

export function sendPaginatedResponse<T>(
  res: Response,
  req: Request,
  items: T[],
  total: number,
  params: PaginationParams
): Response {
  const totalPages = Math.ceil(total / params.limit) || 1;
  const hasMore = params.page < totalPages;

  // Standard REST pagination headers
  res.setHeader("X-Total-Count", String(total));
  res.setHeader("X-Page", String(params.page));
  res.setHeader("X-Limit", String(params.limit));
  res.setHeader("X-Total-Pages", String(totalPages));
  res.setHeader("X-Has-More", String(hasMore));

  // If client explicitly requested pagination via query params or header
  if (params.isExplicitPagination || req.headers["x-request-paginated"] === "true") {
    const payload: PaginatedResult<T> = {
      data: items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasMore,
      },
    };
    return res.json(payload);
  }

  // Backward-compatible direct array response for legacy web / mobile consumers
  return res.json(items);
}
