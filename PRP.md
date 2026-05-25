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

| Phase | Name | Duration | Goal |
|-------|------|----------|------|
| **P0** | Foundation | 1 week | Scaffold + DB + Auth + Design system |
| **P1** | Core Domain | 2 weeks | Orders CRUD + Freshness engine + Preview Mode |
| **P2** | Batch & Workflow | 1 week | Batch orders + Approval flow + Cascade |
| **P3** | Reports & Dashboard | 1 week | Dashboard + Stale reports + Analytics |
| **P4** | Polish & Deploy | 1 week | Testing + Performance + Deploy |

---

## 🏗️ P0 — Foundation (Week 1)

### Deliverables
- [ ] Next.js 16 project scaffolded with Tailwind v4
- [ ] shadcn/ui installed + custom theme (minimal white, thin borders, soft cards)
- [ ] Google Noto Sans Thai font configured
- [ ] Prisma schema ครบทุก entity (persons, orders, salary_base_adjustments, salary_adjustment_applicants, employee_education_adjustments, employee_change_log, compensation_rounds, compensation_disbursements, compensation_to_salary, order_batches)
- [ ] TiDB Cloud connection + Prisma client setup
- [ ] Auth.js configured (credentials provider for ขรก. login)
- [ ] Base layout (sidebar nav + header) with role-based access
- [ ] Thai date utility (พ.ศ. formatting with date-fns + 543)
- [ ] Sentry initialized
- [ ] Sonner toast provider

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

## 📋 P1 — Core Domain (Weeks 2-3)

### Deliverables
- [ ] **Orders List Page** (`/orders`)
  - TanStack Table with sortable columns
  - Filters: order_type, order_status, effective_date range
  - Row actions: view, edit, preview impact
  - Bulk actions: approve selected, batch create
- [ ] **Order Detail Page** (`/orders/[id]`)
  - Full order information with freshness flags per field
  - Status badges: 🟢 latest / 🟡 stale / 🔴 corrected
  - Correction chain display (corrected_from / corrected_by)
  - Activity log (employee_change_log entries)
- [ ] **New Order Form** (`/orders/new`)
  - React Hook Form + Zod validation
  - Fields: employee, order_type, effective_date, salary, salary_as_of_date, position fields, org fields
  - Auto-fill snapshot from employee_current_state
  - Validation: salary_as_of_date ≤ effective_date
- [ ] **Edit Order** (`/orders/[id]/edit`)
  - Pre-populated form
  - Track changes → update corrected_from/corrected_by chain
- [ ] **Preview Impact API** (`/api/preview`)
  - POST body: new order draft
  - Returns: affected_orders[], cascade_depth, action_required (revise/cancel)
  - Preview Impact UI showing "จะกระทบ N คำสั่ง"
- [ ] **Freshness Engine** (`lib/freshness.ts`)
  - `isOrderStale()` — 6 checks (salary, position, type, level, org, system adjustments)
  - `getMaxSalaryEffectiveDate()` — UNION 5 sources
  - `cascadeStaleCheck()` — with visited set + max_depth=10

### Key Files
```
app/orders/page.tsx
app/orders/[id]/page.tsx
app/orders/new/page.tsx
components/orders/order-table.tsx
components/orders/order-form.tsx
components/orders/order-detail.tsx
components/orders/freshness-badge.tsx
components/orders/impact-preview.tsx
lib/freshness.ts
lib/validation/order-schema.ts
app/api/orders/route.ts
app/api/orders/[id]/route.ts
app/api/preview/route.ts
```

---

## 📦 P2 — Batch & Workflow (Week 4)

### Deliverables
- [ ] **Batch List Page** (`/batches`)
  - Table with batch_no, batch_type, effective_date, status
  - Stats columns: total_orders, clean_orders, affected_orders, blocker_orders
  - Health indicator: 🟢 / 🟡 / 🔴
- [ ] **Batch Detail** (`/batches/[id]`)
  - Orders within batch with inline freshness status
  - Actions: Approve All / Approve Clean Only / Reject
  - Blocker orders highlighted
- [ ] **Create Batch** (`/batches/new`)
  - Upload/Select multiple employees
  - Batch type selection (salary_apr, salary_oct, promotion, transfer)
  - Auto-generate batch_no
- [ ] **Batch Workflow Engine**
  - Status transitions: draft → previewing → previewed → approved / partial / cancelled
  - Cron job (Vercel Cron): cleanup expired previews (preview_expires_at < NOW())
- [ ] **Cascade API** (`/api/cascade`)
  - Triggered on order activation
  - Sets status_* = 'stale' on affected orders
  - Respects max_depth=10 + visited set

### Key Files
```
app/batches/page.tsx
app/batches/[id]/page.tsx
app/batches/new/page.tsx
components/batches/batch-table.tsx
components/batches/batch-detail.tsx
components/batches/batch-health-badge.tsx
lib/batch-engine.ts
app/api/batches/route.ts
app/api/batches/[id]/route.ts
app/api/cascade/route.ts
```

---

## 📊 P3 — Reports & Dashboard (Week 5)

### Deliverables
- [ ] **Dashboard** (`/dashboard`)
  - KPI cards: Active Orders, Stale Orders, Pending Batches, Employees
  - Recent activity feed
  - Quick actions: Create Order, Create Batch, View Stale
- [ ] **Stale Orders Report** (`/reports/stale`)
  - Full stale_orders_dashboard view as UI
  - Group by: employee, order_type, stale_reason
  - Export to Excel/CSV
- [ ] **Employee List** (`/employees`)
  - Table with current position, salary, status
  - Link to employee's order history
- [ ] **Employee Detail** (`/employees/[id]`)
  - Timeline of all orders (visual timeline)
  - Current state snapshot
  - Change log history
- [ ] **Audit Trail Report** (`/reports/audit`)
  - Filterable by: employee, change_type, date range
  - Shows old_value → new_value diffs

### Key Files
```
app/dashboard/page.tsx
app/reports/stale/page.tsx
app/reports/audit/page.tsx
app/employees/page.tsx
app/employees/[id]/page.tsx
components/dashboard/kpi-cards.tsx
components/dashboard/activity-feed.tsx
components/reports/stale-report.tsx
components/employees/employee-timeline.tsx
```

---

## 🚀 P4 — Polish & Deploy (Week 6)

### Deliverables
- [ ] **Testing**
  - Unit tests for freshness engine (`lib/freshness.test.ts`)
  - API route tests (Happy DOM / Playwright)
  - Form validation tests (Zod schemas)
- [ ] **Performance**
  - Prisma query optimization (indexes on person_id, effective_date, order_status)
  - React Server Components where possible
  - TanStack Table virtualization for large datasets
- [ ] **Accessibility**
  - shadcn/ui components already accessible
  - Thai screen reader friendly labels
  - Keyboard navigation for all tables
- [ ] **Security**
  - Auth.js session strategy configured
  - API route protection (middleware)
  - Input sanitization (Prisma handles SQL injection)
- [ ] **Deploy**
  - Vercel project linked to `salary-audit` repo
  - Environment variables: DATABASE_URL, AUTH_SECRET, SENTRY_DSN
  - Production build check
  - Domain: `salary-audit.vercel.app`
- [ ] **Documentation**
  - README.md with setup instructions
  - `.env.example`
  - Architecture diagram (optional)

### Key Files
```
.env.example
README.md
__tests__/freshness.test.ts
__tests__/api/orders.test.ts
middleware.ts
vercel.json
```

---

## 📅 Timeline Summary

```
Week 1  [P0] ████████░░░░░░░░░░░░  Foundation
Week 2  [P1] ░░████████░░░░░░░░░░  Core Domain (1/2)
Week 3  [P1] ░░░░████████░░░░░░░░  Core Domain (2/2)
Week 4  [P2] ░░░░░░████████░░░░░░  Batch & Workflow
Week 5  [P3] ░░░░░░░░████████░░░░  Reports & Dashboard
Week 6  [P4] ░░░░░░░░░░████████░░  Polish & Deploy
        ─────────────────────────────────────
        Total: ~6 weeks to production
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

1. **Functional**: สร้างคำสั่งใหม่ → Preview Impact → Approve → Cascade แก้คำสั่งเก่าได้
2. **Data Integrity**: `salary_as_of_date ≤ effective_date` ผ่าน validation ทุกครั้ง
3. **Performance**: หน้า Orders โหลด < 2 วินาที (1,000 แถว)
4. **Thai UX**: ทุกวันที่แสดง พ.ศ. (e.g., 25 พ.ค. 2569)
5. **Auth**: ไม่ login = เข้าหน้าไหนไม่ได้ยกเว้น /login
6. **Mobile**: Layout responsive ใช้ได้บน tablet + mobile
7. **Error Handling**: API error → แสดง Sonner toast + log to Sentry

---

*PRP v1.0 | Created: 2026-05-25 | Status: Ready for P0 kickoff*
