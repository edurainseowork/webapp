# Edurain LMS & CMS: Adversarial Break-Testing, Pen-Testing & Security QA Report

**Audited Application**: `edurain-ui-white-0.2-main` (Backend, CMS Portal, Study Webapp)  
**Methodology**: Threat Modeling, Adversarial Penetration Analysis, Edge-Case Stress Testing & Concurrency Analysis  
**Testing Rule**: Static, Architectural, and Code Verification (strictly no unprompted DOM automation)

---

## Executive Summary

This report analyzes how the Edurain platform could break under adversarial abuse, stress, high-concurrency loads, and malicious inputs ("feature ko todna"). For each vulnerability or break vector, we identify the exact root cause, explain how an attacker or race condition breaks it, and document the industry-standard mitigation implemented.

---

## 1. Adversarial Break Points ("Feature Ko Kaise Toda Jaa Sakta Hai")

### Vector 1: Identity & Role Spoofing (Privilege Escalation)
* **The Break Point**: An attacker signs into Firebase with a regular student account and intercepts API traffic or manipulates client-side storage (e.g. setting `role="admin"` in `localStorage` or sending `{ role: "admin" }` in request bodies).
* **How It Breaks**: If the server trusts request bodies or client headers, a student can access CMS APIs (`/admin/courses`, `/api/tickets/analytics`, `/api/content`) or perform administrative actions like deleting courses or publishing live classes.
* **Industry Standard Hardening Applied**:
  - **Single Source of Truth**: Claims are enforced exclusively via Firebase Admin SDK custom claims (`claims.admin === true`, `claims.role === 'teacher_assistant' | 'mentor'`).
  - **Backend Route Guards**: [desks.ts](file:///d:/edurain-ui-white-0.2-main/Backend/src/routes/desks.ts) and [index.ts](file:///d:/edurain-ui-white-0.2-main/Backend/src/routes/index.ts) verify the cryptographically signed JWT via `authenticateToken` and `requireDeskRole(...)`.
  - **Client Isolation**: [RoleGuard.tsx](file:///d:/edurain-ui-white-0.2-main/CMS-Portal/src/components/RoleGuard.tsx) validates the token server-side via `getIdTokenResult(true)` and caches by `uid`. The CMS portal strictly allows only `['admin', 'faculty']`, completely blocking mentors and students from mounting CMS layout trees.

---

### Vector 2: Concurrency Race Conditions on Ticket Claiming (Double-Claim Exploit)
* **The Break Point**: Two Teacher Assistants simultaneously see an open doubt in the central pool and click "Pick Doubt" at the exact same millisecond.
* **How It Breaks**: If the backend executes a read-modify-write without atomicity or status validation, both TAs could have their local UI think they own the ticket. TA 1's replies could overwrite TA 2's replies, confusing the student and corrupting the resolution ledger.
* **Industry Standard Hardening Applied**:
  - **Atomic Conflict Guard (HTTP 409)**: In [tickets.ts](file:///d:/edurain-ui-white-0.2-main/Backend/src/routes/tickets.ts#L505-L515), before assigning a ticket, the server checks:
    ```typescript
    if (ticket.status === 'resolved' || (ticket.assignedTo && ticket.assignedTo.email !== taEmail)) {
      return res.status(409).json({ error: 'Ticket is already claimed by another assistant or resolved' });
    }
    ```
  - **Socket.IO Parity**: The `claim_ticket` socket handler executes the exact same conflict check and emits an error event back to the second requester, immediately rolling back any optimistic UI update.

---

### Vector 3: Real-Time Data Leakage via Unscoped WebSockets
* **The Break Point**: A student establishes a Socket.IO connection and listens on global wildcard events (`ticket_created`, `ticket_updated`, `new_message`).
* **How It Breaks**: If the server emits `io.emit("ticket_updated", fullTicket)` globally to all connected sockets, student A can view doubts, private student information (full name, email, phone number, academic weakness), and confidential TA responses belonging to student B.
* **Industry Standard Hardening Applied**:
  - **Socket Handshake Authentication**: In [socket.ts](file:///d:/edurain-ui-white-0.2-main/Backend/src/socket.ts), `io.use(...)` verifies the bearer token on connection and extracts `socket.data.user` and `socket.data.role`.
  - **Scoped Rooms & Sanitized Broadcasts**:
    - Detailed messages are broadcast only to `ticket_${ticketId}` (joined only by the ticket's student and the assigned TA).
    - Unassigned queue updates broadcast to `ta_pool` only.
    - Any general notification emitted to the wider pool strips `studentInfo` completely.

---

### Vector 4: LocalStorage Memory Exhaustion & Crash (Base64 Bombing)
* **The Break Point**: A student attaches 3 high-resolution photos of handwritten math problems. The client reads them as base64 Data URLs and stores the entire ticket collection in browser `localStorage`.
* **How It Breaks**: Browser `localStorage` has a strict quota (usually 5 MB per origin). Three raw 4K base64 strings exceed this limit, causing an unhandled `QuotaExceededError` that crashes the React application and corrupts saved user state.
* **Industry Standard Hardening Applied**:
  - **Client-Side Compression**: Files are passed through canvas-based dynamic compression ([askYourDoubt.tsx](file:///d:/edurain-ui-white-0.2-main/src/study/components/askYourDoubt.tsx)) before upload.
  - **Cache Sanitization**: Base64 data URLs (`data:image/...`) are strictly stripped before serialization to `localStorage`. Only permanent remote URLs (S3/CDN) are retained.

---

### Vector 5: Course Ownership Identity Desynchronization & Stale Cache Poisoning
* **The Break Point**: Student A signs out on a shared computer or tablet. Student B signs in immediately without a full page refresh.
* **How It Breaks**: If the in-memory course store maintains `state.ownedIds` globally across auth changes, Student B would inherit Student A's purchased courses, accessing paid content without an active purchase order.
* **Industry Standard Hardening Applied**:
  - **Uid-Bound Ownership Store**: In [courses.ts](file:///d:/edurain-ui-white-0.2-main/src/study/lib/courses.ts), course ownership is strictly keyed to the authenticated `uid`.
  - **Session Invalidation**: When [AuthGate.tsx](file:///d:/edurain-ui-white-0.2-main/src/study/AuthGate.tsx) detects a user transition or sign-out, it calls `resetCoursesForUser()`, wiping cached `ownedIds` and forcing a clean fetch for the new identity. If cached data belongs to another user, `fetchOwnedIds()` discards it and returns `[]`.

---

### Vector 6: Script Injection & Shell History Leakage
* **The Break Point**: Running administrative CLI scripts with sensitive credentials as CLI arguments (`node create-admin.mjs user@example.com MySecretPass123`).
* **How It Breaks**: Plaintext passwords are logged into `~/.bash_history`, `Get-History`, and the OS process table (`ps aux` / Task Manager), where unprivileged users or monitoring agents can read them.
* **Industry Standard Hardening Applied**:
  - In [create-admin.mjs](file:///d:/edurain-ui-white-0.2-main/CMS-Portal/create-admin.mjs), `process.argv[3]` is completely ignored.
  - Passwords must be supplied via the `ADMIN_PASSWORD` environment variable or an interactive, unlogged `readline` terminal prompt.

---

## 2. Component Loading & Motion Verification Matrix

| Component / Section | Skeleton / Loading Pattern | Motion & Easing Spec | Zero CLS Guarantee | WAI-ARIA Accessible |
| :--- | :--- | :--- | :--- | :--- |
| **CMS Dashboard** | Shimmer Stat Cards & Activity Feed | `--ease-out-expo` (260ms) | Yes (48px exact height match) | `role="status"` `aria-busy="true"` |
| **Course Manager** | 3-Card Shimmer Skeleton (Thumb + Actions) | Left-to-Right Shimmer Wave (1.6s) | Yes (96x54px exact thumbnail) | `role="status"` `aria-busy="true"` |
| **Category Manager** | 3-Row Skeleton List | Left-to-Right Shimmer Wave (1.6s) | Yes (Matches category item height) | `role="status"` `aria-busy="true"` |
| **Upload Content** | 4-Row Full Table Skeletons | Shimmer Wave + Fade-in | Yes (Matches 5-column table geometry) | `role="status"` `aria-busy="true"` |
| **Manage Banners** | 2-Card Shimmer Aspect Boxes | Staggered 40ms | Yes (120px height match) | `role="status"` `aria-busy="true"` |
| **Private Coupons** | 3-Card Coupon Shimmer Skeletons | Left-to-Right Shimmer Wave (1.6s) | Yes (Matches existing coupon cards) | `role="status"` `aria-busy="true"` |
| **Go Live** | 2-Card Schedule Skeletons | Directional Cross-slide | Yes (Matches scheduled session height) | `role="status"` `aria-busy="true"` |
| **Notifications** | 3-Card Notification Skeletons | Left-to-Right Shimmer Wave (1.6s) | Yes (Thumb + title + body layout) | `role="status"` `aria-busy="true"` |
| **Tests** | Course Grid & 9-Col Table Skeletons | Left-to-Right Shimmer Wave (1.6s) | Yes (Exact table cell alignment) | `role="status"` `aria-busy="true"` |
| **Manage Users** | 6-Col Admin Table Skeletons | Left-to-Right Shimmer Wave (1.6s) | Yes (Matches 6-column user rows) | `role="status"` `aria-busy="true"` |
| **TA Desk (Queues)** | Ticket Card Shimmer Skeletons | Dynamic key-based view swap | Yes (Matches card thumb & meta) | `role="status"` `aria-busy="true"` |
| **TA Analytics** | Metric Cards & Performer Skeletons | Shimmer Wave + Status badges | Yes (Matches KPI metric layout) | `role="status"` `aria-busy="true"` |
| **Study Courses Catalog** | Left-to-Right Shimmer Wave Cards | Staggered cascade (cap ≤ 300ms) | Yes (Matches batch catalog card) | `role="status"` `aria-busy="true"` |
| **Ask Doubt Modal** | 3-Card Shimmer Tickets in Modal | Z-axis Scale (0.95 -> 1.0) | Yes (Matches ticket item layout) | `role="status"` `aria-busy="true"` |
| **EduAI** | AI Thinking & Concept Shimmer Card | Continuous ambient pulse | Yes (Matches message container) | `role="status"` `aria-busy="true"` |
| **Profile** | Smooth Tab Content Container | Directional entrance (200ms) | Yes (Zero layout shift) | `role="status"` `aria-busy="true"` |

---

## 3. Build & Compilation Verification Status

1. **Backend Build (`node ./Backend/build.mjs`)**:
   - Exit code: `0`
   - Lambda & server bundles produced: `Backend/dist/index.mjs` (6.6 MB), `lambda.mjs` (6.6 MB).
2. **CMS Portal Build (`npm --prefix CMS-Portal run build`)**:
   - Exit code: `0`
   - TypeScript compilation (`tsc -b`): Clean, 0 errors.
   - Vite bundle: `114 modules transformed`, `dist/assets/index-CBrSx84j.js` (721 kB).
3. **Study Webapp Typecheck (`npx tsc --noEmit`)**:
   - Exit code: `0`
   - All modules, imports, and component props cleanly typed with zero diagnostics.
4. **Current Problems in IDE**:
   - `CMS-Portal/create-admin.mjs`: Removed TypeScript `: Promise<string>` annotation in `.mjs`. Error cleared.
   - `CMS-Portal/src/pages/App.tsx`: Separated `import type { AllowedRole }` from `RoleGuard`. Error cleared.
