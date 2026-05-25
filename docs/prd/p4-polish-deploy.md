# PRD — P4 Polish & Deploy

## 1. Overview

**Phase:** P4 — Polish & Deploy
**Duration:** 1 week
**Goal:** ทำให้โครงการ production-ready: มี test coverage, performance optimization, documentation, และพร้อม deploy

**Builds on:** P0 (Foundation), P1 (Core Domain), P2 (Batch & Workflow), P3 (Reports & Dashboard)

**Constraint:** `node_modules` เสียบน VPS — ไม่สามารถ `npm install` package ใหม่ได้ → tests รันใน CI เท่านั้น, local build ใช้ dependencies เดิม

**Test runner:** Node.js 20+ built-in `node:test` + `node:assert` — zero dependencies, รันผ่าน `node --import tsx --test __tests__/*.test.ts`

---

## 2. Feature Requirements

### 2.1 Unit Tests — Freshness Engine — **NEW**

**Purpose:** ทดสอบ `lib/freshness.ts` ทุก function ให้ครอบคลุม edge cases

**Test runner:** `node:test` + `node:assert` (Node.js 20 built-in, zero npm install)

**Tests:**
- `isOrderStale()` — salary stale, position stale, type stale, level stale, org stale, all fresh
- `getMaxSalaryEffectiveDate()` — returns max date from all sources, handles nulls
- `cascadeStaleCheck()` — single level cascade, multi-level with max_depth, circular prevention
- `validateOrderFreshness()` — full validation returns all 5 flags
- Edge cases: null fields, corrected orders (exclude_order_id), missing salary data, empty database

**Test data:** `__tests__/fixtures/seed-freshness.ts` — create minimal Prisma records in `before()` hook

**Files:**
- `__tests__/freshness.test.ts`
- `__tests__/fixtures/seed-freshness.ts`

**Run:** `node --import tsx --test __tests__/freshness.test.ts`

### 2.2 Unit Tests — API Routes — **NEW**

**Purpose:** ทดสอบ API route handlers โดย import handler functions โดยตรง (ไม่ต้อง start server)

**Approach:** Import handler `{ GET, POST }` จาก route files, pass mock `NextRequest`, assert on `NextResponse`

**Routes to test:**
- `GET /api/employees` — pagination (page=1,limit=10), search filter, empty results
- `GET /api/employees/[id]` — valid id returns person, invalid id returns 404
- `POST /api/batches` — create batch, duplicate batchNo returns 409
- `GET /api/batches` — list batches, empty state
- `GET /api/dashboard/summary` — KPI counters ≥ 0
- `GET /api/dashboard/stale` — filters by stale status

**Test data:** `__tests__/fixtures/seed-api.ts` — create persons + orders in `before()` hook, clean in `after()`

**Files:**
- `__tests__/api/employees.test.ts`
- `__tests__/api/batches.test.ts`
- `__tests__/api/dashboard.test.ts`
- `__tests__/fixtures/seed-api.ts`

**Run:** `node --import tsx --test __tests__/api/*.test.ts`

### 2.3 Performance — Prisma Indexes — **UPDATE**

**Purpose:** เพิ่ม indexes สำหรับ queries ที่วิเคราะห์แล้วว่าจำเป็นจริง

**Analysis:**
- `staleWhere` query (used in `/dashboard`, `/api/dashboard/stale`, export) → `WHERE orderStatus IN (...) AND (statusSalary = 'stale' OR ...)` → **add `[orderStatus, statusSalary]`**
- Employee change log (`/employees/[id]` changes, `/reports/audit`) → `WHERE employeeId = X ORDER BY createdAt DESC` → **add `[employeeId, createdAt]`**

**Not adding (YAGNI):**
- `[createdAt]` — activity feed ใช้ `take: 10`, small dataset ไม่มีผล
- `[changeType, createdAt]` — audit filter ใช้ `take: 50` + pagination, index overkill
- `[employeeId, effectiveDate]` — มีอยู่แล้ว

**Implementation:**
```prisma
model Order {
  // ... existing fields ...
  @@index([orderStatus, statusSalary])  // NEW
  // @@index([employeeId, effectiveDate]) — already exists
}

model EmployeeChangeLog {
  // ... existing fields ...
  @@index([employeeId, createdAt])     // NEW
}
```

**Files:** `prisma/schema.prisma` (add 2 lines)

### 2.4 CI — Add Test Step — **UPDATE**

**Purpose:** CI ต้องรัน tests ทุกครั้งก่อน merge

**Current CI:** install → prisma generate → db push → lint → build → seed → type check

**Add after seed:**
```yaml
- name: Run tests
  run: node --import tsx --test __tests__/*.test.ts __tests__/api/*.test.ts
  env:
    DATABASE_URL: "file:./dev.db"
```

### 2.5 Documentation — README + .env.example — **NEW**

**Purpose:** developer ใหม่ setup โครงการได้ใน 5 นาที

**README sections:**
1. คำอธิบายโครงการ (ภาษาไทย) — ระบบตรวจสอบความถูกต้องของข้อมูลในคำสั่งข้าราชการ
2. Tech stack table
3. Quick start (5 ขั้นตอน: clone → install → env → prisma → dev)
4. Default login: `admin / password` (จาก `prisma/seed.ts`)
5. Project structure tree
6. Available commands (`dev`, `build`, `lint`, `test`, `db push`)

**`.env.example`:**
```env
DATABASE_URL="file:./dev.db"    # SQLite (dev) or MySQL URL (prod)
AUTH_SECRET="your-secret-here"  # Auth.js session encryption
```

**Files:**
- `README.md` (overwrite)
- `.env.example` (create)

### 2.6 Deploy Prep — Environment Checklist — **NEW**

**Purpose:** เตรียมพร้อม deploy บน Vercel โดยไม่ต้อง `vercel.json`

**Vercel auto-detection:** Next.js 16 + Prisma — Vercel auto-configures serverless functions

**Required env vars on Vercel:**
| Variable | Value | Source |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` (local) / MySQL URL (production) | secrets |
| `AUTH_SECRET` | `openssl rand -base64 32` | secrets |
| `NODE_VERSION` | `20` | vercel config |

**Post-deploy checks:**
1. `/dashboard` — KPI cards render
2. `/employees` — table with data (or empty state)
3. `/api/dashboard/summary` — returns JSON
4. Build succeeds in production mode

**No `vercel.json` needed** — Next.js auto-detection handles everything.

---

## 3. API Routes Summary

ไม่มี API routes ใหม่ใน P4 (มีแต่เพิ่ม tests)

---

## 4. UI Pages Summary

ไม่มี pages ใหม่ใน P4

---

## 5. Non-Functional Requirements

- **Tests:** ทุก test ผ่านใน CI (`node --import tsx --test`)
- **Tests runtime:** < 30 seconds ทั้งหมด (typical CI budget)
- **Build:** `npm run build` ผ่านไม่มี error
- **CI:** green — ทุก step ใน GitHub Actions ผ่าน
- **Docs:** README ครบถ้วน, `.env.example` ถูกต้อง
- **Thai:** README เป็นภาษาไทยเป็นหลัก (อังกฤษเสริม)

---

## 6. Dependencies

**ไม่มี npm install ใหม่** — ใช้ของที่มีอยู่แล้ว:

| Dependency | Version | Purpose | Status |
|---|---|---|---|
| node:test | Node 20+ built-in | Test runner | ✅ built-in |
| node:assert | Node 20+ built-in | Assertions | ✅ built-in |
| tsx | ^4.x | TypeScript execution | ✅ in devDeps |

---

## 7. Out of Scope (YAGNI — P5 or later)

- E2E tests (Playwright) — ต้องการ browser + dependencies 🔧
- UI component tests (React Testing Library) — 🔧
- Performance profiling / Lighthouse — 🔧
- Accessibility audit (axe-core) — 🔧
- Custom Vercel domain — 🔧
- Sentry alerting config — 🔧
- CI badge ใน README — 🟢 (ง่ายแต่ไม่จำเป็นตอนนี้)

---

## 8. Success Criteria

1. ✅ `node --import tsx --test __tests__/*.test.ts` — freshness tests ผ่าน
2. ✅ `node --import tsx --test __tests__/api/*.test.ts` — API tests ผ่าน
3. ✅ `npm run build` — build ผ่านไม่มี error
4. ✅ CI green — ทุก step ใน GitHub Actions ผ่าน (รวม test step)
5. ✅ `README.md` — setup ได้ใน 5 ขั้นตอน + default credentials
6. ✅ `.env.example` — ทุก required env var มีคำอธิบาย
7. ✅ Prisma indexes — `prisma db push` ผ่านไม่มี error
8. ✅ Branch workflow — PRD→PRP→branch→PR→CI→merge

---

*PRD v2.0 — P4 Polish & Deploy — 25 พ.ค. 2569*
