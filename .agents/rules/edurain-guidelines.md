# 🛡️ EduRain Engineering Architecture & Code Standards

Every modification to existing code and any newly introduced code must adhere to these criteria:

---

### 1. Multi-Tier Caching (L1 In-Memory + Redis L2)
- All read queries must use the Cache-Aside Engine with Singleflight Request Coalescing (`perfEngine.ts`).
- 99% of read requests must be served in `<1ms` directly from RAM or Redis.
- Stampede protection prevents database overload when hundreds of users request the same data simultaneously.
- When an admin updates or deletes data, the cache prefix is **immediately invalidated** (`invalidateCachePrefix`).

```typescript
import { getOrSetCache, invalidateCachePrefix } from "../lib/perfEngine";

// 1. Reading cached data (TTL in seconds)
const courses = await getOrSetCache("edurain:courses:all", 300, async () => {
  return await db.select().from(coursesTable);
});

// 2. Invalidating cache on mutations (POST/PUT/DELETE)
await db.insert(coursesTable).values(newCourse);
await invalidateCachePrefix("edurain:courses");
```

---

### 2. Token Bucket Rate Limiting & Abuse Guard
- Protect APIs against DDoS, brute force attacks, and runaway script loops using `security.ts` & `abuseGuardEngine.ts`.
- Employ **Dual IP + User Identifier** strategies (`ip+identifier`) so one malicious actor cannot exhaust limits for an entire shared Wi-Fi/NAT IP.

```typescript
import { rateLimit } from "../middlewares/security";

router.get(
  "/sensitive-action",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    keyPrefix: "rl:action:",
    keyStrategy: "ip+identifier",
    algorithm: "token-bucket"
  }),
  async (req, res) => {
    res.json({ success: true });
  }
);
```

---

### 3. Zero-Leak Logging & Error Shield (Pino)
- Centralized JSON logging (`lib/logger.ts`) with **PII Masking** (passwords, phone numbers, email addresses, secret keys auto-redacted).
- In production, internal database errors and stack traces are **never** leaked to clients. Clients receive sanitized HTTP error messages while engineers inspect full structured logs.

```typescript
import { logger } from "../lib/logger";

try {
  logger.info({ userId: req.user.id, action: "enroll" }, "Student enrolled");
} catch (err) {
  logger.error({ err, userId: req.user.id }, "Enrollment failed");
  res.status(500).json({ error: "Could not process enrollment. Please try again." });
}
```

---

### 4. No-Reload Optimistic UI Updates (Client & CMS)
- Zero-reload background synchronization and optimistic UI updates.
- When users perform actions (like deleting or reordering a banner/item), the UI **updates immediately (0ms)**.
- If the network call fails, the state automatically rolls back to the previous snapshot and displays an error toast.
- Silent 401 token auto-refresh keeps users logged in seamlessly without disruptive redirects.

```tsx
const handleDeleteItem = async (id: number) => {
  const previousList = items;
  setItems((prev) => prev.filter((item) => item.id !== id));

  try {
    const res = await apiFetch(`/items/${id}`, { method: "DELETE" });
    if (!res.success) throw new Error(res.error);
    showToast("Item deleted", "success");
  } catch (err: any) {
    setItems(previousList);
    showToast("Failed to delete: " + err.message, "error");
  }
};
```

---

### 5. AWS Resource Guard (Zero-Spam & Cost Control)
- Strict separation between cloud storage and relational databases.
- **NEVER** run live cloud bucket scans (e.g. AWS S3 `ListObjectsV2Command`) inside user or CMS request paths.
- All file metadata (URLs, file sizes, titles, course IDs) **must be stored in PostgreSQL**.
- File uploads use **Presigned URLs** (`/api/upload`) allowing the browser to stream binary directly to S3 without passing heavy buffers through Node.js backend memory.

---

### 6. Banner Standards & Aspect Ratio Guard
- **Web Banners**: `1276 × 250 px` (~5.1:1 ratio, 3.2:1 safe zone).
- **Mobile Banners**: `1.8:1` aspect ratio.
- All CMS uploads validate pixel dimensions client-side before upload to prevent stretched UI banners.

```typescript
const img = new Image();
img.onload = () => {
  const ratio = img.width / img.height;
  if (ratio < 4.5 || ratio > 5.5) {
    showToast("Invalid banner ratio! Web banners must be 1276×250 px (~5.1:1).", "error");
    return;
  }
};
img.src = URL.createObjectURL(file);
```

---

### 7. Verification & Testing Pipeline
Before completing any task or PR, run the automated pipeline to ensure zero regressions:
```bash
# Backend Verification & Build
pnpm --filter @workspace/backend test:check

# CMS Build check
pnpm --filter @workspace/cms-portal build

# Root Web App Build check
pnpm build
```

---

### 8. Summary Checklist
1. **YAGNI & Ponytail First**: Write minimal, standard-library-first code.
2. **Cache Dynamic Reads**: Use `getOrSetCache` on frequently accessed GET endpoints.
3. **Invalidate on Write**: Call `invalidateCachePrefix` whenever creating, editing, or deleting data.
4. **No Direct S3 Bucket Scans**: Store media records in PostgreSQL.
5. **Optimistic UI**: Update UI immediately; rollback on error.
6. **Check Builds**: Always verify `backend`, `cms-portal`, and `frontend` pass with 0 errors.
