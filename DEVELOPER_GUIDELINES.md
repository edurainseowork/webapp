# 🛠️ EduRain Developer Architecture & Coding Guidelines

Welcome to the EduRain engineering codebase. This document outlines the core architecture we have built, how our systems function, and the strict guidelines every developer must follow when adding new features or modifying existing code.

---

## 1. Multi-Tier Caching (L1 In-Memory + Redis L2)

### 📌 What We Built
All read queries use a **Multi-Tier Cache-Aside Engine** with **Singleflight Request Coalescing** (`perfEngine.ts`). 
- 99% of read requests are served in `<1ms` directly from RAM or Redis.
- Stampede protection prevents database overload when hundreds of users request the same data simultaneously.
- When an admin updates or deletes data, the cache prefix is **immediately invalidated**.

### 💻 Code Example
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

## 2. Token Bucket Rate Limiting & Abuse Guard

### 📌 What We Built
Atomic Redis Lua Token Bucket Rate Limiting (`security.ts` & `abuseGuardEngine.ts`).
- Protects APIs against DDoS, brute force attacks, and runaway script loops.
- Employs **Dual IP + User Identifier** strategies so one malicious user cannot exhaust limits for an entire shared Wi-Fi/NAT IP.

### 💻 Code Example
```typescript
import { rateLimit } from "../middlewares/security";

// Apply rate limit: 100 requests per 60 seconds per IP/User
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

## 3. Zero-Leak Logging & Error Shield (Pino)

### 📌 What We Built
Centralized JSON logging (`lib/logger.ts`) with **PII Masking**.
- Passwords, phone numbers, email addresses, and secret keys are automatically redacted.
- In production, internal database errors and stack traces are **never** leaked to clients. Clients receive sanitized HTTP error messages while engineers inspect full structured logs.

### 💻 Code Example
```typescript
import { logger } from "../lib/logger";

try {
  // Structured logging with context (auto-redacts secrets)
  logger.info({ userId: req.user.id, action: "enroll" }, "Student enrolled");
} catch (err) {
  logger.error({ err, userId: req.user.id }, "Enrollment failed");
  res.status(500).json({ error: "Could not process enrollment. Please try again." });
}
```

---

## 4. No-Reload Optimistic UI Updates (Client & CMS)

### 📌 What We Built
Zero-reload background synchronization and optimistic UI updates.
- When users perform actions (like deleting or reordering a banner/item), the UI **updates immediately (0ms)**.
- If the network call fails, the state automatically rolls back to the previous snapshot and displays an error toast.
- Silent 401 token auto-refresh keeps users logged in seamlessly without disruptive redirects.

### 💻 Code Example (React)
```tsx
const handleDeleteItem = async (id: number) => {
  const previousList = items;

  // 1. Optimistic Update (instant UI reaction)
  setItems((prev) => prev.filter((item) => item.id !== id));

  try {
    const res = await apiFetch(`/items/${id}`, { method: "DELETE" });
    if (!res.success) throw new Error(res.error);
    showToast("Item deleted", "success");
  } catch (err: any) {
    // 2. Rollback on failure
    setItems(previousList);
    showToast("Failed to delete: " + err.message, "error");
  }
};
```

---

## 5. AWS Resource Guard (Zero-Spam & Cost Control)

### 📌 What We Built
Strict separation between cloud storage and relational databases.
- **NEVER** run live cloud bucket scans (e.g. AWS S3 `ListObjectsV2Command`) inside user or CMS request paths.
- All file metadata (URLs, file sizes, titles, course IDs) **must be stored in PostgreSQL**.
- File uploads use **Presigned URLs** (`/api/upload`) allowing the browser to stream binary directly to S3 without passing heavy buffers through Node.js backend memory.

### 💻 Code Example
```typescript
// ❌ WRONG: Do NOT scan S3 bucket on every API call (incurs massive AWS billing)
// const res = await s3Client.send(new ListObjectsV2Command({ Bucket: "..." }));

// ✅ CORRECT: Query database table (instant and 0 AWS cost)
const ebooks = await db.select().from(ebooksTable).where(eq(ebooksTable.courseId, id));
```

---

## 6. Banner Standards & Aspect Ratio Guard

### 📌 What We Built
Strict ratio enforcement preventing broken layouts across Web and Mobile:
- **Web Banners**: `1276 × 250 px` (~5.1:1 ratio, 3.2:1 safe zone).
- **Mobile Banners**: `1.8:1` aspect ratio.
- All CMS uploads validate pixel dimensions client-side before upload to prevent stretched UI banners.

### 💻 Code Example
```typescript
const img = new Image();
img.onload = () => {
  const ratio = img.width / img.height;
  // Web ratio validation (~5.1:1 with tolerance)
  if (ratio < 4.5 || ratio > 5.5) {
    showToast("Invalid banner ratio! Web banners must be 1276×250 px (~5.1:1).", "error");
    return;
  }
  // Proceed with upload...
};
img.src = URL.createObjectURL(file);
```

---

## 7. Verification & Testing Pipeline

### 📌 How to Verify Changes
Before opening any PR, run the automated 4-tier pipeline to ensure zero regressions:

```bash
# Run 4-Tier Backend Verification (Build + Integration + Load + 5-Stage Stress + Break Tests)
pnpm --filter @workspace/backend test:check

# Run CMS Build check
pnpm --filter @workspace/cms-portal build

# Run Root Web App Build check
pnpm build
```

---

## 8. Summary Checklist for Every Developer

1. [ ] **YAGNI & Ponytail First**: Write minimal, standard-library-first code. Avoid adding external packages unless essential.
2. [ ] **Cache Dynamic Reads**: Use `getOrSetCache` on frequently accessed GET endpoints.
3. [ ] **Invalidate on Write**: Call `invalidateCachePrefix` whenever creating, editing, or deleting data.
4. [ ] **No Direct S3 Bucket Scans**: Store media records in PostgreSQL.
5. [ ] **Optimistic UI**: Remove or update UI items immediately; rollback on error.
6. [ ] **Check Builds**: Always verify `pnpm --filter @workspace/backend build` and `pnpm --filter @workspace/cms-portal build` pass with 0 errors.
