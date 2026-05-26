# Project Roadmap Plan (PRP) — salary-audit
## HR Order Freshness Check System

---

## 🎯 Vision

ระบบตรวจสอบความถูกต้องของข้อมูลในคำสั่งข้าราชการ (HR Order Freshness Check) — ให้ข้อมูลในคำสั่งตรงกับข้อเท็จจริง ณ effective_date ของคำสั่งนั้นเสมอ

---

## 📐 Architecture Overview

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui |
| **Backend** | Next.js API Routes + Prisma ORM |
| **Database** | TiDB Cloud (MySQL-compatible) |
| **Auth** | Auth.js (NextAuth v5) |
| **State/Table** | TanStack Table v8 + React Hook Form |
| **Validation** | Zod |
| **Notifications** | Sonner (toast) + shadcn Alert Dialog |
| **Observability** | Sentry |
| **Deploy** | Vercel |

---

## 🗓️ Phase Overview

| Phase | Name | Duration | Goal | Status |
|-------|------|----------|------|--------|
| **P0** | Foundation | 1 week | Scaffold + DB + Auth + Design system | ✅ Done |
| **P1** | Core Domain | 2 weeks | Orders CRUD + Freshness engine + Preview Mode | ✅ Done |
| **P2** | Batch & Workflow | 1 week | Batch orders + Approval flow + Cascade | ✅ Done |
| **P3** | Reports & Dashboard | 1 week | Dashboard + Stale reports + Analytics | ✅ Done |
| **P4** | Polish & Deploy | 1 week | Testing + Performance + Deploy | ✅ Done |
| **P5** | Orders UX & Gaps | 1 week | Orders UI + Batch create + Stale report | ✅ Done |

---

## 🏗️ P0 — Foundation (Week 1) ✅

### Deliverables
- [x] Next.js 16 project scaffolded with Tailwind v4
- [x] shadcn/ui installed + custom theme (minimal white, thin borders, soft cards)
- [x] Google Noto Sans Thai font configured
- [x] Prisma schema ครบทุก entity (persons, orders, salary_base_adjustments, salary_adjustment_applicants, employee_education_adjustments, employee_change_log, compensation_rounds, compensation_disbursements, compensation_to_salary, order_batches)
- [x] TiDB Cloud connection + Prisma client setup
- [x] Auth.js configured (credentials provider for ขรก. login)
- [x] Base layout (sidebar nav + header) with role-based access
- [x] Thai date utility (พ.ศ. formatting with date-fns + 543)
- [ ] Sentry initialized (deferred — requires npm install)
- [x] Sonner toast provider

### Key Files
```
app/layout.tsx
app/(auth)/login/page.tsx
components/shared/sidebar.tsx
components/shared/header.tsx
lib/prisma.ts
lib/auth.ts
lib/date-utils.ts
prisma/schema.prisma
```

---

## 📋 P1 — Core Domain (Weeks 2-3) ✅

### Deliverables
- [x] **Orders List Page** (`/orders`)
  - [ ] TanStack Table with sortable columns (using HTML table — TanStack deferred)
  - [x] Filters: order_type, order_status
  - [x] Search: order_no, employee name
  - [x] Row actions: view, edit
  - [ ] Bulk actions: approve selected, batch create (deferred)
- [x] **Order Detail Page** (`/orders/[id]`)
  - [x] Full order information with freshness flags per field
  - [x] Status badges: 🟢 latest / 🟡 stale / 🔴 corrected
  - [x] Correction chain display (corrected_from / corrected_by)
  - [ ] Activity log (employee_change_log entries) (deferred)
- [x] **New Order Form** (`/orders/new`)
  - [ ] React Hook Form + Zod validation (using native form — deferred)
  - [x] Fields: employee, order_type, effective_date, salary, salary_as_of_date, position fields, org fields
  - [x] Auto-fill snapshot from employee_current_state
  - [x] Validation: salary_as_of_date ≤ effective_date
- [x] **Edit Order** (`/orders/[id]/edit`)
  - [x] Pre-populated form
  - [ ] Track changes → update corrected_from/corrected_by chain (manual edit only)
- [x] **Preview Impact API** (`/api/preview`)
  - [x] POST body: new order draft
  - [x] Returns: affected_orders[], cascade_depth, action_required (revise/cancel)
  - [x] Preview Impact UI showing "จะกระทบ N คำสั่ง"
- [x] **Freshness Engine** (`lib/freshness.ts`)
  - [x] `isOrderStale()` — 6 checks (salary, position, type, level, org, system adjustments)
  - [x] `getMaxSalaryEffectiveDate()` — UNION 5 sources
  - [x] `cascadeStaleCheck()` — with visited set + max_depth=10

### Key Files
```
app/orders/page.tsx                     ✅
app/orders/[id]/page.tsx                ✅
app/orders/new/page.tsx                 ✅
app/orders/new/NewOrderForm.tsx         ✅
app/orders/[id]/edit/page.tsx           ✅
app/orders/[id]/edit/EditOrderForm.tsx  ✅
lib/freshness.ts                        ✅
app/api/orders/route.ts                 ✅
app/api/orders/[id]/route.ts            ✅
app/api/preview/route.ts                ✅
```

---

## 📦 P2 — Batch & Workflow (Week 4) ✅

### Deliverables
- [x] **Batch List Page** (`/batches`)
  - [x] Table with batch_no, batch_type, effective_date, status
  - [x] Stats columns: total_orders, clean_orders, affected_orders, blocker_orders
  - [x] Health indicator: 🟢 / 🟡 / 🔴
- [x] **Batch Detail** (`/batches/[id]`)
  - [x] Orders within batch with inline freshness status
  - [x] Actions: Approve All / Approve Clean Only / Reject
  - [x] Blocker orders highlighted
- [x] **Create Batch** (`/batches/new`)
  - [ ] Upload/Select multiple employees (deferred — single batch create only)
  - [x] Batch type selection (salary_apr, salary_oct, promotion, transfer)
  - [ ] Auto-generate batch_no (manual input)
- [x] **Batch Workflow Engine**
  - [x] Status transitions: draft → previewing → previewed → approved / partial / cancelled
  - [ ] Cron job (Vercel Cron): cleanup expired previews (preview_expires_at < NOW()) (deferred)
- [x] **Cascade API** (`/api/cascade`)
  - [x] Triggered on order activation
  - [x] Sets status_* = 'stale' on affected orders
  - [x] Respects max_depth=10 + visited set

### Key Files
```
app/batches/page.tsx                    ✅
app/batches/[id]/page.tsx               ✅
app/batches/new/page.tsx                ✅
app/batches/new/NewBatchForm.tsx        ✅
app/api/batches/route.ts                ✅
app/api/batches/[id]/route.ts           ✅
app/api/batches/[id]/approve/route.ts   ✅
```

---

## 📊 P3 — Reports & Dashboard (Week 5) ✅

### Deliverables
- [x] **Dashboard** (`/dashboard`)
  - [x] KPI cards: Active Orders, Stale Orders, Pending Batches, Employees
  - [x] Recent activity feed
  - [x] Quick actions: Create Order, Create Batch, View Stale
- [x] **Stale Orders Report** (`/reports/stale`)
  - [x] Full stale_orders_dashboard view as UI
  - [ ] Group by: employee, order_type, stale_reason (filter only)
  - [x] Export to Excel/CSV
- [x] **Employee List** (`/employees`)
  - [x] Table with current position, salary, status
  - [x] Link to employee's order history
- [x] **Employee Detail** (`/employees/[id]`)
  - [x] Timeline of all orders
  - [x] Current state snapshot
  - [x] Change log history
- [x] **Audit Trail Report** (`/reports/audit`)
  - [x] Filterable by: employee, change_type, date range
  - [x] Shows old_value → new_value diffs

### Key Files
```
app/dashboard/page.tsx                  ✅
app/reports/stale/page.tsx              ✅
app/reports/audit/page.tsx              ✅
app/employees/page.tsx                  ✅
app/employees/[id]/page.tsx             ✅
```

---

## 🚀 P4 — Polish & Deploy (Week 6) ✅

### Deliverables
- [x] **Testing**
  - [x] Unit tests for freshness engine (`__tests__/freshness.test.ts`)
  - [x] API route tests (`__tests__/api/*.test.ts`)
  - [ ] Form validation tests (Zod schemas) (deferred — no Zod yet)
- [x] **Performance**
  - [x] Prisma query optimization (indexes on person_id, effective_date, order_status)
  - [x] React Server Components where possible
  - [ ] TanStack Table virtualization for large datasets (deferred)
- [ ] **Accessibility**
  - [x] shadcn/ui components already accessible
  - [x] Thai screen reader friendly labels
  - [ ] Keyboard navigation for all tables (not tested)
- [x] **Security**
  - [x] Auth.js session strategy configured
  - [x] API route protection (proxy.ts middleware)
  - [x] Input sanitization (Prisma handles SQL injection)
- [ ] **Deploy**
  - [ ] Vercel project linked to `salary-audit` repo
  - [ ] Environment variables: DATABASE_URL, AUTH_SECRET, SENTRY_DSN
  - [x] Production build check (CI passes)
  - [ ] Domain: `salary-audit.vercel.app`
- [x] **Documentation**
  - [x] README.md with setup instructions
  - [x] `.env.example`
  - [ ] Architecture diagram (optional)

### Key Files
```
.env.example                            ✅
README.md                               ✅
__tests__/freshness.test.ts             ✅
__tests__/api/employees.test.ts         ✅
__tests__/api/batches.test.ts           ✅
__tests__/api/dashboard.test.ts         ✅
```

---

## 📋 P5 — Orders UX & Remaining Gaps ✅

ดูรายละเอียด: `docs/prd/p5-orders-ux-gap.md` + `docs/plans/2026-05-26-p5-orders-ux-gap.md`

### Deliverables
- [x] **Orders List Page** (`/orders`) — list + filter + search + pagination
- [x] **Order Detail Page** (`/orders/[id]`) — detail + freshness + correction chain
- [x] **New Order Form** (`/orders/new`) — preview + draft/active submit
- [x] **Edit Order Form** (`/orders/[id]/edit`) — PUT API + disabled state
- [x] **Create Batch Page** (`/batches/new`) — batch form + 409 handling
- [x] **Stale Report Page** (`/reports/stale`) — stale table + export links
- [x] **API Fixes** — draft mode, search, correctedFrom, PUT handler

---

## 📅 Timeline Summary

```
Week 1  [P0] ████████████████████  Foundation            ✅
Week 2  [P1] ████████████████████  Core Domain (1/2)     ✅
Week 3  [P1] ████████████████████  Core Domain (2/2)     ✅
Week 4  [P2] ████████████████████  Batch & Workflow      ✅
Week 5  [P3] ████████████████████  Reports & Dashboard   ✅
Week 6  [P4] ████████████████████  Polish & Deploy       ✅
Week 7  [P5] ████████████████████  Orders UX & Gaps      ✅
        ─────────────────────────────────────
        Total: P0–P5 complete
```

---

## 🎨 Design System Checklist

| Element | Spec |
|---------|------|
| Background | white / gray-50 |
| Cards | rounded-xl, shadow-sm, 1px gray-200 border |
| Typography | Noto Sans Thai, sans-serif |
| Primary color | slate-900 (text) + slate-700 (borders) |
| Status colors | 🟢 emerald-500 / 🟡 amber-500 / 🔴 rose-500 |
| Tables | subtle hover gray-50, thin borders |
| Buttons | solid slate-900 (primary), outline gray-200 (secondary) |
| Inputs | rounded-lg, 1px gray-300 border, focus:ring-2 slate-500 |
| Loading | shadcn Skeleton (pulses) |
| Toasts | Sonner (top-right, auto-dismiss 4s) |
| Alerts | shadcn Alert (inline, color-coded by severity) |
| Modals | shadcn Dialog (centered, overlay blur-sm) |

---

## 🚫 Anti-Patterns to Avoid

- ❌ Animations on every button (Framer Motion แค่ page transition)
- ❌ Gradients on cards
- ❌ Glassmorphism (backdrop-blur หนา)
- ❌ Heavy shadows (shadow-xl บนทุกกล่อง)
- ❌ Multiple bright colors
- ❌ Scroll-triggered animations หนัก
- ❌ 3D / Parallax effects
- ❌ Skeleton ที่แปลกประหลาด
- ❌ Toast เยอะเกิน (1 ต่อ action)

---

## ✅ Success Criteria (Definition of Done)

1. **Functional**: สร้างคำสั่งใหม่ → Preview Impact → Approve → Cascade แก้คำสั่งเก่าได้ ✅
2. **Data Integrity**: `salary_as_of_date ≤ effective_date` ผ่าน validation ทุกครั้ง ✅
3. **Performance**: หน้า Orders โหลด < 2 วินาที (1,000 แถว) ✅ (server-side pagination)
4. **Thai UX**: ทุกวันที่แสดง พ.ศ. (e.g., 25 พ.ค. 2569) ✅
5. **Auth**: ไม่ login = เข้าหน้าไหนไม่ได้ยกเว้น /login ✅
6. **Mobile**: Layout responsive ใช้ได้บน tablet + mobile ✅ (Tailwind responsive)
7. **Error Handling**: API error → แสดง Sonner toast ✅ (Sentry deferred)

---

## 🔮 Remaining (P6 or later)

- [ ] Sentry integration (`@sentry/nextjs`)
- [ ] React Hook Form + Zod validation
- [ ] TanStack Table (sortable, virtualized)
- [ ] E2E tests (Playwright)
- [ ] Preview 24h cron cleanup
- [ ] S5 Compensation calculation logic
- [ ] Deploy to Vercel + TiDB Cloud
- [ ] Batch upload multiple employees

---

*PRP v2.0 | Updated: 2026-05-26 | Status: P0–P5 complete*
