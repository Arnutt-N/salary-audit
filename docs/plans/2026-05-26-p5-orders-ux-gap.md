# P5 — Orders UX & Remaining Gaps — Implementation Plan

## Goal
ปิด UI gap ที่เหลือ: Orders pages (list/detail/new/edit), Batch create, Stale report — ให้ workflow ครบ สร้างคำสั่ง → preview → approve → cascade

## Constraints
- `node_modules` เสียบน VPS — ใช้ deps ที่มีเท่านั้น
- ไม่สร้าง API routes ใหม่ (ยกเว้น PUT /api/orders/[id])
- Follow existing patterns: server components, Prisma direct, `toThaiDate()`, Tailwind + shadcn
- ทุกวันที่แสดงเป็น พ.ศ. ใช้ `toThaiDate()` จาก `lib/date-utils.ts`

---

## Tasks

### Task 1: Fix `POST /api/orders` — Support Draft Mode
**File:** `app/api/orders/route.ts`
**Change:** Line 54 — `orderStatus: "active"` → `orderStatus: body.orderStatus ?? "active"`
**Why:** PRD §2.3 ต้องรองรับ "บันทึกแบบร่าง" (draft) + "บันทึกและเปิดใช้" (active)
**Note:** Freshness check + cascade ต้องรันเฉพาะเมื่อ `orderStatus === "active"` — เพิ่ม if-guard ครอบ line 59-60
**Verify:** `POST /api/orders` with `orderStatus: "draft"` → สร้าง order ได้โดยไม่ run freshness

---

### Task 2: Fix `GET /api/orders` — Add Search Param
**File:** `app/api/orders/route.ts`
**Change:** เพิ่ม `search` param — search by `orderNo` (contains) + `person.firstName`/`lastName` (contains)
**Pattern:** เหมือน `app/api/employees/route.ts` ที่ใช้ `OR` + `contains`
```typescript
const search = searchParams.get("search")
if (search) {
  where.OR = [
    { orderNo: { contains: search } },
    { person: { firstName: { contains: search } } },
    { person: { lastName: { contains: search } } },
  ]
}
```
**Note:** ต้องเปลี่ยน `include` เป็น nested `where` สำหรับ person search

---

### Task 3: Fix `GET /api/orders/[id]` — Add correctedFrom Include
**File:** `app/api/orders/[id]/route.ts`
**Change:** เพิ่ม `correctedFrom` relation ใน include (line 17):
```typescript
correctedFromOrder: {
  select: { id: true, orderNo: true, orderType: true },
},
```
**Why:** §2.2 Correction Chain — ต้อง link กลับไปคำสั่งเดิมที่ถูกแก้
**Note:** Prisma relation ชื่อ `correctedFrom` (Int?) + `correctedBy` (Order?) — ต้อง include ทั้ง 2 ฝั่ง

---

### Task 4: Create `PUT /api/orders/[id]` — Edit Order Data
**File:** `app/api/orders/[id]/route.ts` (เพิ่ม PUT handler)
**Behavior:**
- รับ body: `orderNo, orderType, issueDate, effectiveDate, salary, salaryAsOfDate, positionName, positionType, positionLevel, bureau, division, department, ministry`
- Validate: order exists + status is `draft` or `active`
- Update order fields (ไม่ touch `orderStatus`, `correctedBy`, `correctedFrom`)
- ถ้า status = `active` → re-run `validateOrderFreshness` + `cascadeStaleCheck`
- Return updated order
**Pattern:** ดู PATCH handler ที่มีอยู่เป็น template

---

### Task 5: Orders List Page (`/orders`)
**File:** `app/orders/page.tsx` (NEW)
**Pattern:** Copy from `app/employees/page.tsx` — server component, Prisma direct
**Features:**
- `searchParams: { page?, search?, type?, status? }`
- Search form: text input (order_no/employee name) + select (order_type) + select (order_status)
- Table columns: #, ประเภท, เลขที่, ข้าราชการ (link → /employees/[id]), วันที่มีผล (พ.ศ.), สถานะ, Freshness badge
- Pagination (PAGE_SIZE = 50)
- Empty state: "ยังไม่มีคำสั่ง"
- Freshness badge: ถ้ามี stale flag ใด → 🟡, ถ้า corrected → 🔴, else 🟢
**Data:** `prisma.order.findMany({ include: { person } })` + `prisma.order.count()`
**Date format:** ใช้ `toThaiDate()` จาก `lib/date-utils.ts`

---

### Task 6: Order Detail Page (`/orders/[id]`)
**File:** `app/orders/[id]/page.tsx` (NEW)
**Pattern:** Copy from `app/employees/[id]/page.tsx`
**Sections:**
- **A. Breadcrumb:** คำสั่ง / #id
- **B. Order Info Card:** 2-col grid — order_type, order_no, issue_date (พ.ศ.), effective_date (พ.ศ.), salary, salary_as_of_date, position fields, org fields, order_status badge
- **C. Freshness Status:** 5 badges (status_salary, status_position, status_type, status_level, status_org) — each 🟢/🟡/🔴
- **D. Correction Chain:** corrected_from → link, corrected_by → link (ใช้ data จาก API ที่แก้แล้ว)
- **E. Actions:** [✏️ แก้ไข] → `/orders/[id]/edit` (if draft/active), [↩️ กลับ] → `/orders`
**Data:** `prisma.order.findUnique({ include: { person, batch, corrected, correctedFromOrder } })`

---

### Task 7: New Order Form (`/orders/new`)
**File:** `app/orders/new/page.tsx` (NEW, client component)
**Pattern:** Form page — ดู `app/batches/[id]/BatchActions.tsx` เป็น reference สำหรับ client component
**Sections:**
- **A. Employee Select:** text input → fetch `/api/employees?search=...` → dropdown list → select → auto-fill
- **B. Order Fields:** order_type (select), order_no, issue_date, effective_date, salary, salary_as_of_date, position_name, position_type, position_level, bureau, division, department, ministry
- **C. Validation:** salary_as_of_date ≤ effective_date (client-side check)
- **D. Actions:**
  - [🔍 Preview Impact] → POST `/api/preview` → แสดงผลลัพธ์ (affected orders list)
  - [💾 บันทึกแบบร่าง] → POST `/api/orders` with `orderStatus: "draft"` → redirect `/orders`
  - [✅ บันทึกและเปิดใช้] → POST `/api/orders` with `orderStatus: "active"` → redirect `/orders`
- **Error handling:** Sonner toast on error
**Note:** ใช้ `"use client"` + `useState` สำหรับ employee select + preview result

---

### Task 8: Edit Order Form (`/orders/[id]/edit`)
**File:** `app/orders/[id]/edit/page.tsx` (NEW)
**Pattern:** เหมือน Task 7 แต่ pre-populate จาก existing order
**Behavior:**
- Fetch order data จาก `prisma.order.findUnique` (server component wrapper)
- Pass data เป็น props ให้ client component form
- On save: `PUT /api/orders/[id]` (Task 4)
- แสดง warning ถ้า order ไม่ใช่ draft/active → disable form
- Error handling: Sonner toast on error

---

### Task 9: Create Batch Page (`/batches/new`)
**File:** `app/batches/new/page.tsx` (NEW, client component)
**Fields:** batch_no (text), batch_type (select: salary_apr/salary_oct/promotion/transfer), effective_date (date), description (textarea)
**Submit:** POST `/api/batches` → redirect `/batches/[id]`
**Error handling:** Sonner toast + 409 duplicate batch_no → แสดงข้อความ "เลขนี้มีอยู่แล้ว"
**Pattern:** เหมือน Task 7 — client component + fetch

---

### Task 10: Stale Report Page (`/reports/stale`)
**File:** `app/reports/stale/page.tsx` (NEW)
**Pattern:** Copy from `app/reports/audit/page.tsx` — server component, filters
**Data source:** `prisma.order.findMany` ตรง (ไม่ผ่าน API) — filter `orderStatus: { in: ["active", "superseded"] }` + stale flags
**Features:**
- Table: ข้าราชการ, ประเภท, วันที่มีผล (พ.ศ.), ปัญหา (stale reasons), สถานะ
- Filter: order_type dropdown
- Export button: link ไป `/api/reports/stale/export?format=xlsx` + `?format=csv`
- Empty state: "🎉 ไม่มีคำสั่ง stale"
- Pagination

---

### Task 11: Build + CI Verify
**Verify:**
- `npm run build` ผ่าน
- Nav link `/orders` ไม่ 404
- ทุกหน้า render ได้ (manual check)
- CI green

---

## Implementation Order

```
Task 1 (API fix draft)  ─┐
Task 2 (API search)      ─┤
Task 3 (API correctedFrom)─┤─ API fixes (ทำก่อน)
Task 4 (API PUT)         ─┘
                          │
Task 5 (Orders list)     ─┐
Task 6 (Order detail)    ─┤─ UI pages (ทำตาม API)
Task 7 (New order)       ─┤
Task 8 (Edit order)      ─┤
Task 9 (Batch create)    ─┤
Task 10 (Stale report)   ─┘
                          │
Task 11 (Build verify)   ── Final check
```

## Verification Checklist
- [ ] `POST /api/orders` with `orderStatus: "draft"` → creates draft without freshness check
- [ ] `GET /api/orders?search=test` → returns matching orders
- [ ] `GET /api/orders/[id]` → includes correctedFrom order
- [ ] `PUT /api/orders/[id]` → updates order fields + re-runs freshness if active
- [ ] `/orders` — list + filter + search + pagination works
- [ ] `/orders/[id]` — detail + freshness badges + correction chain links
- [ ] `/orders/new` — create draft + create active + preview impact
- [ ] `/orders/[id]/edit` — edit existing order
- [ ] `/batches/new` — create batch → redirect to detail
- [ ] `/reports/stale` — stale orders table + export links
- [ ] `npm run build` — no errors
- [ ] CI green on push

---

*PRP v1.0 — P5 Orders UX & Remaining Gaps — 26 พ.ค. 2569*
