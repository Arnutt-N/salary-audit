# PRD — P3 Reports & Dashboard

## 1. Overview

**Phase:** P3 — Reports & Dashboard  
**Duration:** 1 week  
**Goal:** ทำให้ผู้ใช้สามารถดูภาพรวมระบบ (Dashboard), จัดการข้อมูลบุคคล (Employee List/Detail), ดูรายงานคำสั่งที่ข้อมูลไม่ตรง (Stale Report แบบ export ได้), และตรวจสอบประวัติการแก้ไข (Audit Trail)

**Builds on:** P0 (Foundation), P1 (Core Domain), P2 (Batch & Workflow)

---

## 2. Feature Requirements

### 2.1 Employee List (`/employees`) — **NEW**

**Purpose:** ตารางแสดงรายชื่อข้าราชการทั้งหมด พร้อมข้อมูลปัจจุบัน

**Data columns:**
| Field | Source | Sortable | Filterable |
|---|---|---|---|
| person_id | persons.id | ✅ | — |
| name (ชื่อ-สกุล) | persons.name_th | ✅ | text search |
| current_position | persons.current_position | ✅ | — |
| current_type | persons.current_type | ✅ | — |
| current_level | persons.current_level | ✅ | — |
| current_org | persons.current_org | ✅ | — |
| effective_date | persons.current_effective_date | ✅ | date range |
| status (active/inactive) | persons.status | ✅ | dropdown |
| order_count | COUNT(orders WHERE person_id) | ✅ | — |
| stale_count | COUNT(orders WHERE is_stale=true) | ✅ | — |

**Features:**
- Server-side search + pagination (cursor-based)
- Click row → navigate to `/employees/[id]`
- Badge for stale: 🔴 มีคำสั่ง stale → สีแดง, 🟢 ทุกคำสั่ง fresh → สีเขียว
- Empty state: "ยังไม่มีข้อมูลข้าราชการ"

**API:** `GET /api/employees` — search, pagination, sorting

---

### 2.2 Employee Detail (`/employees/[id]`) — **NEW**

**Purpose:** ดูข้อมูลบุคคลแบบเจาะลึก

**Sections:**

#### A. Current Snapshot Card
- ชื่อ-นามสกุล, ตำแหน่งปัจจุบัน, ระดับ, ประเภท, สังกัด
- เงินเดือนปัจจุบัน (ถ้ามี)
- effective_date ล่าสุด
- Status badge (active/inactive)

#### B. Order Timeline
- แสดงคำสั่งทั้งหมดของบุคคลนี้ เรียงตาม effective_date (ล่าสุดก่อน)
- แต่ละรายการใน timeline แสดง:
  - order_type (icon + label)
  - effective_date (พ.ศ.)
  - สรุปสั้น ๆ (e.g. "ย้ายไป กอง...", "เลื่อนเป็น ชำนาญการพิเศษ")
  - Freshness badge (🟢 fresh / 🟡 stale / 🔴 corrected)
- Click item → navigate to order detail
- Empty state: "ยังไม่มีคำสั่ง"

#### C. Change Log
- แสดงประวัติการเปลี่ยนแปลงจาก `employee_change_log`
- Table: วันที่ | ฟิลด์ที่เปลี่ยน | ค่าเก่า | ค่าใหม่ | คำสั่งที่อ้างอิง
- Pagination

**API:**
- `GET /api/employees/[id]` — current snapshot
- `GET /api/employees/[id]/orders` — order timeline
- `GET /api/employees/[id]/changes` — change log

---

### 2.3 Dashboard (`/dashboard`) — **CONSOLIDATE**

**Purpose:** รวม `/` (KPI cards) + `/dashboard/stale` เป็นหน้าเดียว

**Sections:**

#### A. KPI Cards (ย้ายจาก `/`)
| Card | Value | Source |
|---|---|---|
| คำสั่งทั้งหมด | count | orders.count |
| คำสั่งที่ stale | count | orders WHERE is_stale=true |
| Batches รอดำเนินการ | count | order_batches WHERE status='draft' |
| ข้าราชการทั้งหมด | count | persons.count |

#### B. Quick Actions
- ➕ สร้างคำสั่งใหม่ → `/orders/new`
- 📦 สร้าง Batch → `/batches/new`
- 🔍 ดูคำสั่ง stale → scroll to stale section

#### C. Recent Activity Feed
- 10 คำสั่งล่าสุดเรียงตาม created_at
- แสดง: order_type, employee name, effective_date, status badge
- Click → navigate to order detail

#### D. Stale Orders Summary (ย้ายจาก `/dashboard/stale`)
- Table: employee | order_type | effective_date | stale_reasons | actions
- Group by: employee, order_type, stale_reason
- Filter: order_type, stale_reason, date range
- **Export button:** ดาวน์โหลดเป็น Excel (.xlsx) / CSV

**API:**
- `GET /api/dashboard/summary` — KPI counters (มีแล้ว, อาจต้องปรับ)
- `GET /api/dashboard/stale` — stale orders (มีแล้ว, อาจต้องปรับ)
- `GET /api/dashboard/activity` — recent activity (NEW)

---

### 2.4 Stale Export — **NEW**

**Purpose:** ดาวน์โหลดรายงานคำสั่ง stale เป็นไฟล์

**Formats:**
- **Excel (.xlsx):** ทุก stale order + freshness flag details + Thai column headers
- **CSV:** lightweight, comma-separated, UTF-8 with BOM (for Excel Thai compatibility)

**API:** `GET /api/reports/stale/export?format=xlsx|csv&filters=...`

**Implementation:** Server-side (API route), ใช้ library เช่น `exceljs` หรือ `xlsx`

---

### 2.5 Audit Trail Report (`/reports/audit`) — **NEW**

**Purpose:** ดูประวัติการเปลี่ยนแปลงทั้งหมดในระบบ

**Data source:** `employee_change_log` table

**Columns:**
| Field | Description |
|---|---|
| วันที่ | changed_at (พ.ศ.) |
| ข้าราชการ | persons.name_th |
| ฟิลด์ที่เปลี่ยน | field_name (e.g. salary, position, level) |
| ค่าเก่า | old_value |
| ค่าใหม่ | new_value |
| คำสั่งที่อ้างอิง | orders.order_ref (clickable link) |
| ประเภทคำสั่ง | orders.order_type |
| effective_date | orders.effective_date (พ.ศ.) |

**Filters:**
- employee (search/select)
- change_type (field_name)
- date range (changed_at)
- order_type

**Pagination:** cursor-based

**API:** `GET /api/reports/audit`

---

### 2.6 Navigation Update

**Purpose:** ปรับ nav bar ให้สะท้อนโครงสร้างใหม่

**Current nav:** Home, Orders, Batches, Dashboard (stale)
**New nav:**
- 📊 **Dashboard** → `/dashboard` (consolidated)
- 👥 **Employees** → `/employees`
- 📋 **Orders** → `/orders`
- 📦 **Batches** → `/batches`
- 📄 **Reports** → dropdown: Stale Report, Audit Trail

**Redirects:**
- `/` → redirect to `/dashboard`
- `/dashboard/stale` → redirect to `/dashboard#stale` (or just show stale section)

---

## 3. API Routes Summary

| Method | Route | Status | Description |
|---|---|---|---|
| GET | `/api/employees` | NEW | List employees (search, paginate, sort) |
| GET | `/api/employees/[id]` | NEW | Employee current snapshot |
| GET | `/api/employees/[id]/orders` | NEW | Employee order timeline |
| GET | `/api/employees/[id]/changes` | NEW | Employee change log |
| GET | `/api/dashboard/summary` | UPDATE | KPI counters (add employee count) |
| GET | `/api/dashboard/stale` | UPDATE | Stale orders (add export support) |
| GET | `/api/dashboard/activity` | NEW | Recent 10 orders |
| GET | `/api/reports/stale/export` | NEW | Export stale to xlsx/csv |
| GET | `/api/reports/audit` | NEW | Audit trail with filters |

---

## 4. UI Pages Summary

| Page | Status | Description |
|---|---|---|
| `/dashboard` | CONSOLIDATE | KPI + activity + stale summary |
| `/employees` | NEW | Employee list with search/pagination |
| `/employees/[id]` | NEW | Snapshot + timeline + change log |
| `/reports/audit` | NEW | Audit trail with filters |
| `/dashboard/stale` | REMOVE | Merge into `/dashboard` |
| `/` | REDIRECT | → `/dashboard` |

---

## 5. Non-Functional Requirements

- **Performance:** Employee list รองรับ 10,000+ แถว (virtual scrolling / server-side pagination)
- **Export:** รองรับ stale orders สูงสุด 5,000 แถว (chunked generation)
- **Thai:** ทุกวันที่เป็น พ.ศ., ทุก label เป็นภาษาไทย, ฟอนต์ Noto Sans Thai
- **Mobile:** ทุกหน้าต้อง responsive (table → card view on mobile)
- **Auth:** ทุก API route ต้องผ่าน middleware auth check

---

## 6. Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| exceljs | ^4.x | Excel export |
| @tanstack/react-table | ^8.x | Tables (ใช้ต่อจาก P2) |
| date-fns | ^4.x | Thai date formatting |

---

## 7. Out of Scope (P4)

- Unit/E2E tests → P4
- Sentry integration → P4 (setup แล้ว, config ใน P4)
- Performance optimization (indexes, virtualization) → P4
- Deploy to Vercel → P4

---

## 8. Success Criteria

1. ✅ `/employees` → แสดงรายชื่อ 10,000 คนได้ (pagination)
2. ✅ `/employees/[id]` → แสดง timeline + change log ถูกต้อง
3. ✅ `/dashboard` → KPI cards + activity feed + stale summary
4. ✅ Export stale → ไฟล์ .xlsx เปิดใน Excel ได้ ภาษาไทยไม่เพี้ยน
5. ✅ `/reports/audit` → filter ได้ทุก field
6. ✅ Nav bar → สะท้อนโครงสร้างใหม่
7. ✅ Build pass (CI green)
8. ✅ วันที่ทั้งหมดเป็น พ.ศ.
9. ✅ Mobile responsive

---

*PRD v1.0 — P3 Reports & Dashboard — 26 พ.ค. 2569*
