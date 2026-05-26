# PRD — P6 Production Polish

## 1. Overview

- **Phase:** P6 — Production Polish
- **Duration:** 1 week
- **Goal:** ปรับปรุงคุณภาพ production: form validation (Zod), table UX (TanStack), preview cleanup (cron), error tracking (Sentry)
- **Builds on:** P0–P5 (all complete)
- **Constraint:** node_modules ต้อง reinstall ก่อน — เพิ่ม deps ใหม่ได้แล้ว

---

## 2. Feature Requirements

### 2.1 React Hook Form + Zod Validation — **NEW**

**Purpose:** แทน native form ด้วย validated form ที่มี error messages ภาษาไทย

**Forms to upgrade:**
- `/orders/new/NewOrderForm.tsx`
- `/orders/[id]/edit/EditOrderForm.tsx`
- `/batches/new/NewBatchForm.tsx`

**Zod schemas:**
```typescript
// lib/validation/order-schema.ts
export const orderSchema = z.object({
  employeeId: z.number().positive("กรุณาเลือกข้าราชการ"),
  orderType: z.string().min(1, "กรุณาเลือกประเภทคำสั่ง"),
  orderNo: z.string().nullable().optional(),
  issueDate: z.string().min(1, "กรุณาวันที่ลงคำสั่ง"),
  effectiveDate: z.string().min(1, "กรุณาวันที่มีผล"),
  salary: z.number().nullable().optional(),
  salaryAsOfDate: z.string().nullable().optional(),
  positionName: z.string().nullable().optional(),
  positionType: z.string().nullable().optional(),
  positionLevel: z.string().nullable().optional(),
  bureau: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  ministry: z.string().nullable().optional(),
}).refine(
  (data) => !data.salaryAsOfDate || !data.effectiveDate || data.salaryAsOfDate <= data.effectiveDate,
  { message: "เงินเดือน ณ วันที่ ต้องไม่เกินวันที่มีผล", path: ["salaryAsOfDate"] }
)

export const batchSchema = z.object({
  batchNo: z.string().min(1, "กรุณากรอกเลขที่ชุด"),
  batchType: z.string().min(1, "กรุณาเลือกประเภท"),
  effectiveDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})
```

**Dependencies:**
- `react-hook-form`
- `@hookform/resolvers`
- `zod`

---

### 2.2 TanStack Table — **NEW**

**Purpose:** แทน HTML table ด้วย sortable, filterable table

**Pages to upgrade:**
- `/orders/page.tsx`
- `/employees/page.tsx`
- `/batches/page.tsx`
- `/reports/stale/page.tsx`
- `/reports/audit/page.tsx`

**Features per table:**
- Column sorting (click header to sort)
- Column visibility toggle
- Responsive: horizontal scroll on mobile

**Dependencies:**
- `@tanstack/react-table`

**Pattern:** Client component wrapper `<DataTable>` ที่รับ columns + data

---

### 2.3 Preview Cron Cleanup — **NEW**

**Purpose:** ลบ preview orders ที่หมดอายุ (>24h)

**Implementation:**
- API route: `GET /api/cron/cleanup-previews`
  - ค้นหา `orderStatus = 'preview'` + `previewExpiresAt < NOW()`
  - DELETE หรือ SET `orderStatus = 'cancelled'`
  - Return count of cleaned orders
- Vercel cron: `vercel.json` → `crons: [{ path: "/api/cron/cleanup-previews", schedule: "0 2 * * *" }]`

**No new dependencies**

---

### 2.4 Sentry Integration — **NEW**

**Purpose:** Error tracking ใน production

**Dependencies:**
- `@sentry/nextjs`

**Implementation:**
- `sentry.client.config.ts` — client-side init
- `sentry.server.config.ts` — server-side init
- `next.config.ts` — withSentryConfig wrapper
- `instrumentation.ts` — server-side instrumentation
- DSN: `SENTRY_DSN` env var

---

## 3. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7 | Form state management |
| `@hookform/resolvers` | ^3 | Zod resolver |
| `zod` | ^3 | Schema validation |
| `@tanstack/react-table` | ^8 | Table component |
| `@sentry/nextjs` | ^8 | Error tracking |

---

## 4. Files Summary

```
lib/validation/order-schema.ts              [NEW]    Zod schemas
lib/validation/batch-schema.ts              [NEW]    Batch schema
components/shared/data-table.tsx            [NEW]    TanStack DataTable wrapper
app/api/cron/cleanup-previews/route.ts      [NEW]    Cron endpoint
vercel.json                                 [NEW]    Cron config
sentry.client.config.ts                     [NEW]    Sentry client
sentry.server.config.ts                     [NEW]    Sentry server
instrumentation.ts                          [NEW]    Sentry instrumentation
app/orders/new/NewOrderForm.tsx             [MODIFY] React Hook Form + Zod
app/orders/[id]/edit/EditOrderForm.tsx      [MODIFY] React Hook Form + Zod
app/batches/new/NewBatchForm.tsx            [MODIFY] React Hook Form + Zod
app/orders/page.tsx                         [MODIFY] TanStack Table
app/employees/page.tsx                      [MODIFY] TanStack Table
app/batches/page.tsx                        [MODIFY] TanStack Table
app/reports/stale/page.tsx                  [MODIFY] TanStack Table
app/reports/audit/page.tsx                  [MODIFY] TanStack Table
next.config.ts                              [MODIFY] Sentry wrapper
package.json                                [MODIFY] New dependencies
```

---

## 5. Non-Functional Requirements

- **Validation:** ทุก form มี error messages ภาษาไทย
- **Table:** Sort + responsive ทุกหน้า
- **Error tracking:** Sentry captures production errors
- **Cron:** Preview cleanup ทุกวัน 02:00 UTC
- **Build:** `npm run build` ผ่าน
- **CI:** green

---

## 6. Success Criteria

1. ✅ Order form — Zod validation + error messages ภาษาไทย
2. ✅ Edit form — same validation
3. ✅ Batch form — same validation
4. ✅ All tables — sortable columns
5. ✅ Preview cleanup — cron endpoint works
6. ✅ Sentry — captures errors (test with intentional throw)
7. ✅ `npm run build` — ผ่าน
8. ✅ CI green

---

*PRD v1.0 — P6 Production Polish — 26 พ.ค. 2569*
