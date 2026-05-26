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
**Changes:**
1. Line 54 — `orderStatus: "active"` → `orderStatus: body.orderStatus ?? "active"`
2. Wrap freshness + cascade (line 59-60) ใน if-guard:
   ```typescript
   if (order.orderStatus === "active") {
     await validateOrderFreshness(order.id)
     const cascadeCount = await cascadeStaleCheck(order.id)
   }
   ```
3. Wrap change log creation (line 63-84) ใน if-guard เดียวกัน:
   ```typescript
   if (order.orderStatus === "active") {
     await prisma.employeeChangeLog.create({ ... })
   }
   ```
**Why:** PRD §2.3 — draft order ไม่ต้อง run freshness, cascade, หรือสร้าง change log
**Verify:** `POST /api/orders` with `orderStatus: "draft"` → creates order without side effects

---

### Task 2: Fix `GET /api/orders` — Add Search Param
**File:** `app/api/orders/route.ts`
**Change:** เพิ่ม `search` param — search by `orderNo` + `person.firstName`/`lastName`
**Prisma syntax (relation filter ต้องใช้ `is`):**
```typescript
const search = searchParams.get("search")
if (search) {
  where.OR = [
    { orderNo: { contains: search } },
    { person: { is: { firstName: { contains: search } } } },
    { person: { is: { lastName: { contains: search } } } },
  ]
}
```
**Note:** ต้องเปลี่ยน `include` เป็น nested `where` สำหรับ person search — Prisma ใช้ `is` syntax สำหรับ to-one relation filter

---

### Task 3: Fix `GET /api/orders/[id]` — Fetch correctedFrom Order
**File:** `app/api/orders/[id]/route.ts`
**Problem:** `correctedFrom` เป็น `Int?` (plain field) — ไม่ใช่ Prisma relation → ใช้ `include` ไม่ได้
**Solution:** Fetch correctedFrom order แยก query:
```typescript
// เพิ่มหลังจาก fetch order หลัก
const correctedFromOrder = order.correctedFrom
  ? await prisma.order.findUnique({
      where: { id: order.correctedFrom },
      select: { id: true, orderNo: true, orderType: true },
    })
  : null

return NextResponse.json({ ...order, correctedFromOrder, freshness })
```
**Note:** `corrected` (reverse relation) ใช้ `include` ได้ตามปกติ — ดู orders ที่ถูกแก้โดยคำสั่งนี้

---

### Task 4: Create `PUT /api/orders/[id]` — Edit Order Data
**File:** `app/api/orders/[id]/route.ts` (เพิ่ม PUT handler)
**Behavior:**
- รับ body: `orderNo, orderType, issueDate, effectiveDate, salary, salaryAsOfDate, positionName, positionType, positionLevel, bureau, division, department, ministry`
- Validate: order exists + status is `draft` or `active`
- Update order fields (ไม่ touch `orderStatus`, `correctedBy`, `correctedFrom`)
- ถ้า status = `active` → re-run `validateOrderFreshness` + `cascadeStaleCheck`
- ถ้า status = `active` → update `employeeChangeLog` (latest entry สำหรับ order นี้)
- Return updated order
**Pattern:** ดู PATCH handler ที่มีอยู่เป็น template

---

### Task 5: Orders List Page (`/orders`)
**File:** `app/orders/page.tsx` (NEW, server component)
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
**Type labels:** ใช้ `typeLabel` map เดียวกับ `app/employees/[id]/page.tsx`

---

### Task 6: Order Detail Page (`/orders/[id]`)
**File:** `app/orders/[id]/page.tsx` (NEW, server component)
**Pattern:** Copy from `app/employees/[id]/page.tsx`
**Data fetch:**
```typescript
// Prisma query — include ได้เฉพาะ relation fields
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    person: { select: { id: true, firstName: true, lastName: true, ... } },
    batch: { select: { batchNo: true, batchType: true } },
    corrected: { select: { id: true, orderNo: true, orderType: true } },
  },
})

// Fetch correctedFrom แยก (plain Int field, ไม่ใช่ relation)
const correctedFromOrder = order.correctedFrom
  ? await prisma.order.findUnique({
      where: { id: order.correctedFrom },
      select: { id: true, orderNo: true, orderType: true },
    })
  : null
```
**Sections:**
- **A. Breadcrumb:** คำสั่ง / #id
- **B. Order Info Card:** 2-col grid — order_type, order_no, issue_date (พ.ศ.), effective_date (พ.ศ.), salary, salary_as_of_date, position fields, org fields, order_status badge
- **C. Freshness Status:** 5 badges (status_salary, status_position, status_type, status_level, status_org) — each 🟢/🟡/🔴
- **D. Correction Chain:** correctedFromOrder → link กลับ, corrected[] → link ไปข้างหน้า
- **E. Actions:** [✏️ แก้ไข] → `/orders/[id]/edit` (if draft/active), [↩️ กลับ] → `/orders`

---

### Task 7: New Order Form (`/orders/new`)
**Files:**
- `app/orders/new/page.tsx` (server component wrapper — minimal, render `<NewOrderForm />`)
- `app/orders/new/NewOrderForm.tsx` (NEW, `"use client"` — form UI)

**NewOrderForm.tsx features:**
- Employee Select: text input → fetch `/api/employees?search=...` → dropdown → select → auto-fill person fields
- Order Fields: order_type (select), order_no, issue_date, effective_date, salary, salary_as_of_date, position_name, position_type, position_level, bureau, division, department, ministry
- Validation: salary_as_of_date ≤ effective_date (client-side)
- Preview: POST `/api/preview` with `{ employeeId, orderType, effectiveDate, salary, salaryAsOfDate, positionLevel, ... }` → แสดง affected orders
- Submit:
  - [💾 บันทึกแบบร่าง] → POST `/api/orders` with `orderStatus: "draft"` → redirect `/orders`
  - [✅ บันทึกและเปิดใช้] → POST `/api/orders` with `orderStatus: "active"` → redirect `/orders`
- Error handling: Sonner toast on error, stay on form
- Auto-fill: เมื่อ select employee → ดึง current state จาก person record มา pre-fill position/org fields

**Pattern:** ดู `app/batches/[id]/BatchActions.tsx` เป็น reference สำหรับ client component + fetch

---

### Task 8: Edit Order Form (`/orders/[id]/edit`)
**Files:**
- `app/orders/[id]/edit/page.tsx` (server component wrapper — fetch order data, pass as props)
- `app/orders/[id]/edit/EditOrderForm.tsx` (NEW, `"use client"` — form UI)

**page.tsx (server):**
```typescript
const order = await prisma.order.findUnique({ where: { id: parseInt(params.id) } })
if (!order) notFound()
if (!["draft", "active"].includes(order.orderStatus)) {
  // แสดง warning + disable form
}
return <EditOrderForm order={order} />
```

**EditOrderForm.tsx (client):**
- Pre-populate form จาก `order` props
- Same fields + layout as `NewOrderForm.tsx`
- On save: `PUT /api/orders/[id]` (Task 4)
- Warning banner ถ้า order ไม่ใช่ draft/active → disable inputs
- Error handling: Sonner toast on error

---

### Task 9: Create Batch Page (`/batches/new`)
**Files:**
- `app/batches/new/page.tsx` (server component wrapper — minimal)
- `app/batches/new/NewBatchForm.tsx` (NEW, `"use client"` — form UI)

**NewBatchForm.tsx features:**
- Fields: batch_no (text), batch_type (select: salary_apr/salary_oct/promotion/transfer), effective_date (date), description (textarea)
- Submit: POST `/api/batches` → redirect `/batches/[id]`
- Error handling: Sonner toast + 409 duplicate batch_no → "เลขนี้มีอยู่แล้ว"

---

### Task 10: Stale Report Page (`/reports/stale`)
**File:** `app/reports/stale/page.tsx` (NEW, server component)
**Pattern:** Copy from `app/reports/audit/page.tsx` — server component, filters
**Data:** Prisma direct — ไม่ผ่าน API
```typescript
const where = {
  orderStatus: { in: ["active", "superseded"] },
  OR: [
    { statusSalary: "stale" },
    { statusPosition: "stale" },
    { statusType: "stale" },
    { statusLevel: "stale" },
    { statusOrg: "stale" },
  ],
}
```
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
Task 3 (API correctedFrom)─┤─ API fixes (ทำก่อน, ไม่มี dependency ระหว่างกัน)
Task 4 (API PUT)         ─┘
                          │
Task 5 (Orders list)     ─┐
Task 6 (Order detail)    ─┤
Task 7 (New order)       ─┤─ UI pages (Task 7-8 share NewOrderForm/EditOrderForm pattern)
Task 8 (Edit order)      ─┤
Task 9 (Batch create)    ─┤
Task 10 (Stale report)   ─┘
                          │
Task 11 (Build verify)   ── Final check (depends on all above)
```

## File Summary

```
app/api/orders/route.ts                    [MODIFY] Task 1, 2
app/api/orders/[id]/route.ts               [MODIFY] Task 3, 4
app/orders/page.tsx                         [NEW]    Task 5
app/orders/[id]/page.tsx                    [NEW]    Task 6
app/orders/new/page.tsx                     [NEW]    Task 7 (server wrapper)
app/orders/new/NewOrderForm.tsx             [NEW]    Task 7 (client form)
app/orders/[id]/edit/page.tsx              [NEW]    Task 8 (server wrapper)
app/orders/[id]/edit/EditOrderForm.tsx     [NEW]    Task 8 (client form)
app/batches/new/page.tsx                    [NEW]    Task 9 (server wrapper)
app/batches/new/NewBatchForm.tsx            [NEW]    Task 9 (client form)
app/reports/stale/page.tsx                 [NEW]    Task 10
```

## Verification Checklist
- [ ] `POST /api/orders` with `orderStatus: "draft"` → creates draft without freshness/cascade/changeLog
- [ ] `GET /api/orders?search=test` → returns matching orders (by orderNo + employee name)
- [ ] `GET /api/orders/[id]` → includes correctedFromOrder object
- [ ] `PUT /api/orders/[id]` → updates order fields + re-runs freshness if active
- [ ] `/orders` — list + filter + search + pagination works
- [ ] `/orders/[id]` — detail + freshness badges + correction chain links (both directions)
- [ ] `/orders/new` — create draft + create active + preview impact
- [ ] `/orders/[id]/edit` — edit existing order + PUT works
- [ ] `/batches/new` — create batch → redirect to detail
- [ ] `/reports/stale` — stale orders table + export links
- [ ] `npm run build` — no errors
- [ ] CI green on push

---

*PRP v1.1 — P5 Orders UX & Remaining Gaps — 26 พ.ค. 2569*
