# PRD — P5 Orders UX & Remaining Gaps

## 1. Overview

- **Phase:** P5 — Orders UX & Remaining Gaps
- **Duration:** 1 week
- **Goal:** ปิด UI gap ที่เหลือจาก P0–P4: Orders pages (list/detail/new/edit), Batch create, Stale report — ให้ workflow ครบตั้งแต่สร้างคำสั่ง → preview → approve → cascade
- **Builds on:** P0 (Foundation), P1 (Core Domain), P2 (Batch & Workflow), P3 (Reports & Dashboard), P4 (Polish & Deploy)
- **Constraint:** `node_modules` เสียบน VPS — ใช้ dependencies ที่มีอยู่แล้วเท่านั้น
- **Spec Reference:** `hr-order-freshness-check-v2.md` — §9.7 (Preview Mode), §10.1 (Single Order Workflow)

---

## 2. Feature Requirements

### 2.1 Orders List Page (`/orders`) — **NEW**

**Purpose:** ตารางแสดงคำสั่งทั้งหมด พร้อม freshness status

**Data columns:**
- order_type (icon + label ภาษาไทย)
- order_no
- employee name (link → `/employees/[id]`)
- effective_date (พ.ศ.)
- status (draft/preview/active/cancelled/superseded/void)
- freshness badge (🟢 latest / 🟡 stale / 🔴 corrected)
- issue_date (พ.ศ.)

**Features:**
- Server-side pagination (PAGE_SIZE = 50)
- Filter: order_type, order_status
- Search: order_no, employee name (server-side Prisma query)
- Click row → `/orders/[id]`
- Empty state: "ยังไม่มีคำสั่ง"

**Pattern:** Server component (Prisma direct) — same as `/employees`
**API:** `GET /api/orders` — ต้องเพิ่ม `search` param + employee name search

---

### 2.2 Order Detail Page (`/orders/[id]`) — **NEW**

**Purpose:** ดูรายละเอียดคำสั่ง + freshness flags + correction chain

**Sections:**

#### A. Order Info Card
- order_type, order_no, issue_date (พ.ศ.), effective_date (พ.ศ.)
- salary, salary_as_of_date
- position_name, position_type, position_level
- bureau, division, department, ministry
- order_status badge

#### B. Freshness Status
- 5 flags: status_salary, status_position, status_type, status_level, status_org
- Each shows: 🟢 latest / 🟡 stale / 🔴 corrected
- Stale reasons (inline text)

#### C. Correction Chain
- corrected_from → link to original order (ต้อง fetch `correctedFrom` relation)
- corrected_by → link to correcting order (ใช้ `corrected` relation ที่มี)

#### D. Actions
- [✏️ แก้ไข] → `/orders/[id]/edit` (only if draft/active)
- [↩️ กลับ] → `/orders`

**API:** `GET /api/orders/[id]` — ต้องเพิ่ม `correctedFrom` ใน include

---

### 2.3 New Order Form (`/orders/new`) — **NEW**

**Purpose:** สร้างคำสั่งใหม่ พร้อม preview ก่อน save

**Sections:**

#### A. Employee Select
- Search dropdown (by name) — client component
- Auto-fill current state from person record

#### B. Order Fields
- order_type (dropdown)
- order_no (text)
- issue_date (date input)
- effective_date (date input)
- salary (number)
- salary_as_of_date (date input, ≤ effective_date validation)
- position_name, position_type, position_level
- bureau, division, department, ministry

#### C. Preview & Submit
- [🔍 Preview Impact] → POST `/api/preview` → show affected orders
- [💾 บันทึกแบบร่าง] → save as draft (orderStatus='draft')
- [✅ บันทึกและเปิดใช้] → save as active + cascade

**Preview API Request Body:**
```json
{
  "employeeId": 1,
  "orderType": "salary_increase",
  "effectiveDate": "2026-04-01",
  "salary": 25000,
  "salaryAsOfDate": "2025-10-01",
  "positionLevel": "ปฏิบัติการ"
}
```

**Validation:** salary_as_of_date ≤ effective_date (client-side)
**API:** `POST /api/orders` — ต้องแก้ให้รับ `orderStatus` จาก body (ไม่ hardcode active) + `POST /api/preview` (มีแล้ว)
**Error handling:** Sonner toast error + stay on form

---

### 2.4 Edit Order (`/orders/[id]/edit`) — **NEW**

**Purpose:** แก้ไขคำสั่งที่มีอยู่

**Behavior:**
- Pre-populate form with existing order data
- Same form layout as `/orders/new`
- On save: `PUT /api/orders/[id]` (ต้องสร้างใหม่)
- Only editable if orderStatus is `draft` or `active`
- Error handling: Sonner toast error + stay on form

**API:** `PUT /api/orders/[id]` — **ต้องสร้างใหม่** (ยังไม่มี)

---

### 2.5 Create Batch Page (`/batches/new`) — **NEW**

**Purpose:** สร้างชุดคำสั่งใหม่ (batch)

**Fields:**
- batch_no (text or auto-generate)
- batch_type (dropdown: salary_apr, salary_oct, promotion, transfer)
- effective_date (date input)
- description (textarea)

**Submit:** `POST /api/batches` → redirect to `/batches/[id]`
**Error handling:** Sonner toast error + stay on form

---

### 2.6 Stale Report Page (`/reports/stale`) — **NEW**

**Purpose:** หน้าแสดงรายงานคำสั่ง stale พร้อม export

**Data source:** `GET /api/dashboard/stale` (มีแล้ว — reuse ไม่สร้าง route ใหม่)

**Features:**
- Table: employee | order_type | effective_date | stale_reasons
- Filter: order_type, stale_reason (client-side จาก data ที่ดึงมา)
- Export button: xlsx / csv (ใช้ `GET /api/reports/stale/export` ที่มีแล้ว)
- Empty state: "🎉 ไม่มีคำสั่ง stale"

---

### 2.7 Update PRP Checklist — **UPDATE**

**Purpose:** ติ๊ก [x] รายการที่ทำเสร็จแล้วใน `PRP.md`

---

## 3. API Routes Summary

### Existing (ใช้ได้เลย)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/orders` | list orders (ต้องเพิ่ม search) |
| GET | `/api/orders/[id]` | order detail (ต้องเพิ่ม correctedFrom) |
| POST | `/api/orders` | create order (ต้องแก้ draft mode) |
| PATCH | `/api/orders/[id]` | status transition only |
| POST | `/api/preview` | preview impact |
| POST | `/api/batches` | create batch |
| GET | `/api/dashboard/stale` | stale orders |
| GET | `/api/reports/stale/export` | export stale |

### New (ต้องสร้าง)
| Method | Route | Description |
|--------|-------|-------------|
| PUT | `/api/orders/[id]` | edit order data (fields, not status) |

### Modifications (ต้องแก้)
| Route | Change | Reason |
|-------|--------|--------|
| `GET /api/orders` | เพิ่ม `search` param | §2.1 — search by order_no + employee name |
| `GET /api/orders/[id]` | เพิ่ม `correctedFrom` include | §2.2 — correction chain link |
| `POST /api/orders` | รับ `orderStatus` จาก body | §2.3 — draft mode support |

---

## 4. UI Pages Summary

| Page | Status | Description |
|------|--------|-------------|
| `/orders` | NEW | Orders list with filters + pagination |
| `/orders/[id]` | NEW | Order detail + freshness + correction chain |
| `/orders/new` | NEW | New order form + preview |
| `/orders/[id]/edit` | NEW | Edit order form |
| `/batches/new` | NEW | Create batch form |
| `/reports/stale` | NEW | Stale report + export |

---

## 5. Non-Functional Requirements

- **Performance:** Orders list รองรับ 10,000+ rows (server-side pagination)
- **Thai:** ทุกวันที่เป็น พ.ศ., ทุก label เป็นภาษาไทย
- **Mobile:** responsive
- **Auth:** ทุกหน้าผ่าน proxy.ts auth check แล้ว
- **Pattern:** Server components (Prisma direct) — ไม่ fetch ตัวเอง
- **Form:** Native HTML form + client component สำหรับ interactive parts
- **Error handling:** Sonner toast ทุก API error + stay on form

---

## 6. Dependencies

ไม่มี dependencies ใหม่ — ใช้ของที่มี:
- Prisma 7 (มี)
- date-fns + 543 (มี)
- Tailwind v4 + shadcn/ui (มี)
- Sonner (มี)

---

## 7. Out of Scope (P6 or later)

- Sentry integration (ต้อง npm install @sentry/nextjs)
- E2E tests (Playwright)
- TanStack Table (ใช้ HTML table ธรรมดาก่อน)
- React Hook Form + Zod (ใช้ native form ก่อน)
- Preview 24h cron cleanup
- S5 Compensation calculation logic

---

## 8. Success Criteria

1. ✅ `/orders` — แสดงรายการคำสั่ง + filter + search + pagination
2. ✅ `/orders/[id]` — แสดงรายละเอียด + freshness badges + correction chain links
3. ✅ `/orders/new` — สร้างคำสั่งใหม่ได้ (draft + active) + preview impact
4. ✅ `/orders/[id]/edit` — แก้ไขคำสั่งได้ (PUT API ทำงาน)
5. ✅ `/batches/new` — สร้าง batch ใหม่ได้
6. ✅ `/reports/stale` — แสดง stale orders + export link
7. ✅ `npm run build` — build ผ่าน
8. ✅ CI green
9. ✅ Nav link `/orders` ไม่ 404 แล้ว

---

*PRD v1.2 — P5 Orders UX & Remaining Gaps — 26 พ.ค. 2569*
