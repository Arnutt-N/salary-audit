# P3 — Reports & Dashboard Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build employee management, consolidated dashboard, stale export, and audit trail reports

**Architecture:** Backend-first — API routes (Prisma on server) then server-component pages (Prisma directly, no fetch-to-self). Export via API route generating xlsx/csv on server.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + SQLite, Tailwind v4, exceljs, date-fns + 543

**Patterns:** Server components call Prisma directly (never `fetch` to self). API routes use `NextRequest.searchParams` for query params. Thai labels everywhere. Noto Sans Thai font.

---

## Task 1: GET /api/employees — Employee list with search, pagination, sort

**Objective:** API endpoint listing all persons with order/stale counts

**Files:**
- Create: `app/api/employees/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const search = searchParams.get("search") || ""
  const sort = searchParams.get("sort") || "id"
  const order = searchParams.get("order") || "asc"
  const active = searchParams.get("active") // "true" | "false" | undefined

  const where: any = {}
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ]
  }
  if (active === "true") where.isActive = true
  if (active === "false") where.isActive = false

  const orderBy: any = { [sort]: order }

  const [persons, total] = await Promise.all([
    prisma.person.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      select: {
        id: true,
        nameTitle: true,
        firstName: true,
        lastName: true,
        citizenId: true,
        currentPositionName: true,
        currentPositionType: true,
        currentPositionLevel: true,
        currentBureau: true,
        currentDivision: true,
        currentDepartment: true,
        currentMinistry: true,
        currentSalary: true,
        isActive: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.person.count({ where }),
  ])

  // Get stale counts in one query
  const personIds = persons.map((p) => p.id)
  const staleCounts = await prisma.order.groupBy({
    by: ["employeeId"],
    where: {
      employeeId: { in: personIds },
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
    _count: { id: true },
  })
  const staleMap = new Map(staleCounts.map((s) => [s.employeeId, s._count.id]))

  const enriched = persons.map((p) => ({
    id: p.id,
    nameTitle: p.nameTitle,
    firstName: p.firstName,
    lastName: p.lastName,
    citizenId: p.citizenId,
    currentPositionName: p.currentPositionName,
    currentPositionType: p.currentPositionType,
    currentPositionLevel: p.currentPositionLevel,
    currentBureau: p.currentBureau,
    currentDivision: p.currentDivision,
    currentDepartment: p.currentDepartment,
    currentMinistry: p.currentMinistry,
    currentSalary: p.currentSalary,
    isActive: p.isActive,
    orderCount: p._count.orders,
    staleCount: staleMap.get(p.id) ?? 0,
  }))

  return NextResponse.json({ persons: enriched, total, page, limit })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/employees?page=1&limit=5" | python3 -m json.tool
```

Expected: `{ persons: [...], total: N, page: 1, limit: 5 }`

---

## Task 2: GET /api/employees/[id] — Employee current snapshot

**Objective:** Return single person's current state

**Files:**
- Create: `app/api/employees/[id]/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  const person = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      nameTitle: true,
      firstName: true,
      lastName: true,
      citizenId: true,
      currentPositionName: true,
      currentPositionType: true,
      currentPositionLevel: true,
      currentBureau: true,
      currentDivision: true,
      currentDepartment: true,
      currentMinistry: true,
      currentSalary: true,
      salarySystemType: true,
      currentQualification: true,
      qualificationEffectiveDate: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true, changeLogs: true } },
    },
  })

  if (!person) {
    return NextResponse.json({ error: "ไม่พบบุคคลนี้" }, { status: 404 })
  }

  const staleCount = await prisma.order.count({
    where: {
      employeeId: id,
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
  })

  return NextResponse.json({
    ...person,
    orderCount: person._count.orders,
    changeLogCount: person._count.changeLogs,
    staleCount,
  })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/employees/1" | python3 -m json.tool
```

Expected: Object with person fields + `orderCount`, `changeLogCount`, `staleCount`

---

## Task 3: GET /api/employees/[id]/orders — Employee order timeline

**Objective:** Return all orders for a person, sorted by effectiveDate desc

**Files:**
- Create: `app/api/employees/[id]/orders/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  const orders = await prisma.order.findMany({
    where: { employeeId: id },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      salary: true,
      positionName: true,
      positionType: true,
      positionLevel: true,
    },
  })

  const enriched = orders.map((o) => {
    const isStale =
      o.statusSalary === "stale" ||
      o.statusLevel === "stale" ||
      o.statusPosition === "stale" ||
      o.statusType === "stale" ||
      o.statusOrg === "stale"
    const isCorrected = o.orderStatus === "superseded"
    const overall =
      isCorrected ? "corrected" : isStale ? "stale" : "fresh"

    return { ...o, isStale, isCorrected, overall }
  })

  return NextResponse.json({ orders: enriched, total: orders.length })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/employees/1/orders" | python3 -m json.tool
```

Expected: `{ orders: [...], total: N }` with `overall` field on each

---

## Task 4: GET /api/employees/[id]/changes — Employee change log

**Objective:** Return change log entries for a person, with order info

**Files:**
- Create: `app/api/employees/[id]/changes/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNo: true,
            orderType: true,
            effectiveDate: true,
          },
        },
      },
    }),
    prisma.employeeChangeLog.count({ where: { employeeId: id } }),
  ])

  return NextResponse.json({ changes, total, page, limit })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/employees/1/changes" | python3 -m json.tool
```

Expected: `{ changes: [...], total: N }`

---

## Task 5: GET /api/dashboard/activity — Recent activity feed

**Objective:** Return 10 most recent orders with employee name

**Files:**
- Create: `app/api/dashboard/activity/route.ts`

**Step 1: Create the route**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      effectiveDate: true,
      orderStatus: true,
      createdAt: true,
      person: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  return NextResponse.json({ orders })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/dashboard/activity" | python3 -m json.tool
```

Expected: `{ orders: [...] }` with up to 10 items

---

## Task 6: GET /api/dashboard/summary — Update KPI counters

**Objective:** Add missing counters (already exists, just verify / add stale by type)

**Files:**
- Modify: `app/api/dashboard/summary/route.ts`

**Step 1: Read current route**

```bash
cat app/api/dashboard/summary/route.ts
```

**Step 2: Ensure it returns all needed fields**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const staleWhere = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusLevel: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusOrg: "stale" },
    ],
  }

  const [
    totalOrders,
    activeOrders,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
    salaryStale,
    levelStale,
    positionStale,
    typeStale,
    orgStale,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({ where: staleWhere }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({
      where: { status: { in: ["draft", "previewing", "previewed"] } },
    }),
    prisma.person.count({ where: { isActive: true } }),
    prisma.order.count({ where: { orderStatus: { in: ["active", "superseded"] }, statusSalary: "stale" } }),
    prisma.order.count({ where: { orderStatus: { in: ["active", "superseded"] }, statusLevel: "stale" } }),
    prisma.order.count({ where: { orderStatus: { in: ["active", "superseded"] }, statusPosition: "stale" } }),
    prisma.order.count({ where: { orderStatus: { in: ["active", "superseded"] }, statusType: "stale" } }),
    prisma.order.count({ where: { orderStatus: { in: ["active", "superseded"] }, statusOrg: "stale" } }),
  ])

  return NextResponse.json({
    totalOrders,
    activeOrders,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
    staleByType: {
      salary: salaryStale,
      level: levelStale,
      position: positionStale,
      type: typeStale,
      org: orgStale,
    },
  })
}
```

**Step 3: Verify**

```bash
curl -s "http://localhost:3000/api/dashboard/summary" | python3 -m json.tool
```

Expected: All counters + `staleByType` fields

---

## Task 7: GET /api/reports/stale/export — Export stale orders to xlsx/csv

**Objective:** Generate downloadable stale report file

**Files:**
- Create: `app/api/reports/stale/export/route.ts`

**Step 1: Install exceljs**

```bash
cd /opt/data/work/01-projects/gen-ai/salary-audit && npm install exceljs
```

**Step 2: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "xlsx"

  const orders = await prisma.order.findMany({
    where: {
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    select: {
      id: true,
      orderNo: true,
      orderType: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      person: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  if (format === "csv") {
    const BOM = "\uFEFF"
    const header = "ลำดับ,ชื่อ-สกุล,เลขที่คำสั่ง,ประเภท,วันที่มีผล,สถานะคำสั่ง,stale_เงินเดือน,stale_ระดับ,stale_ตำแหน่ง,stale_ประเภท,stale_สังกัด\n"
    const rows = orders.map((o, i) =>
      [
        i + 1,
        `"${o.person.firstName ?? ""} ${o.person.lastName ?? ""}"`,
        o.orderNo ?? "",
        o.orderType,
        o.effectiveDate,
        o.orderStatus,
        o.statusSalary,
        o.statusLevel,
        o.statusPosition,
        o.statusType,
        o.statusOrg,
      ].join(",")
    ).join("\n")

    return new NextResponse(BOM + header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=stale-orders.csv",
      },
    })
  }

  // xlsx
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("คำสั่งที่ต้องแก้ไข")

  ws.columns = [
    { header: "ลำดับ", key: "index", width: 6 },
    { header: "ชื่อ-สกุล", key: "name", width: 25 },
    { header: "เลขที่คำสั่ง", key: "orderNo", width: 15 },
    { header: "ประเภท", key: "orderType", width: 12 },
    { header: "วันที่มีผล", key: "effectiveDate", width: 12 },
    { header: "สถานะคำสั่ง", key: "orderStatus", width: 12 },
    { header: "เงินเดือน stale", key: "statusSalary", width: 14 },
    { header: "ระดับ stale", key: "statusLevel", width: 14 },
    { header: "ตำแหน่ง stale", key: "statusPosition", width: 14 },
    { header: "ประเภท stale", key: "statusType", width: 14 },
    { header: "สังกัด stale", key: "statusOrg", width: 14 },
  ]

  orders.forEach((o, i) => {
    ws.addRow({
      index: i + 1,
      name: `${o.person.firstName ?? ""} ${o.person.lastName ?? ""}`,
      orderNo: o.orderNo,
      orderType: o.orderType,
      effectiveDate: o.effectiveDate,
      orderStatus: o.orderStatus,
      statusSalary: o.statusSalary,
      statusLevel: o.statusLevel,
      statusPosition: o.statusPosition,
      statusType: o.statusType,
      statusOrg: o.statusOrg,
    })
  })

  // Style header row
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  }

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=stale-orders.xlsx",
    },
  })
}
```

**Step 3: Verify**

```bash
curl -s -o /tmp/stale.xlsx "http://localhost:3000/api/reports/stale/export?format=xlsx"
file /tmp/stale.xlsx
# Expected: "Microsoft Excel 2007+"
```

```bash
curl -s "http://localhost:3000/api/reports/stale/export?format=csv" | head -3
# Expected: CSV with BOM + header + data
```

---

## Task 8: GET /api/reports/audit — Audit trail with filters

**Objective:** Filterable audit trail

**Files:**
- Create: `app/api/reports/audit/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const search = searchParams.get("search") || ""
  const changeType = searchParams.get("changeType") || ""
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""
  const orderType = searchParams.get("orderType") || ""

  const where: any = {}

  if (search) {
    where.person = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    }
  }
  if (changeType) where.changeType = changeType
  if (orderType) {
    where.order = { orderType }
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z")
  }

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
        order: {
          select: {
            id: true,
            orderNo: true,
            orderType: true,
            effectiveDate: true,
          },
        },
      },
    }),
    prisma.employeeChangeLog.count({ where }),
  ])

  return NextResponse.json({ changes, total, page, limit })
}
```

**Step 2: Verify**

```bash
curl -s "http://localhost:3000/api/reports/audit?page=1&limit=5" | python3 -m json.tool
```

Expected: `{ changes: [...], total: N }`

---

## Task 9: /employees — Employee list page (server component)

**Objective:** Table of all persons with search, pagination, stale badge

**Files:**
- Create: `app/employees/page.tsx`

**Step 1: Create the page**

```typescript
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const PAGE_SIZE = 50

function statusBadge(isActive: boolean, staleCount: number) {
  if (!isActive) return { label: "⚪ ไม่ประจำการ", cls: "bg-gray-100 text-gray-600" }
  if (staleCount > 0) return { label: "🔴 มีคำสั่ง stale", cls: "bg-red-50 text-red-700" }
  return { label: "🟢 ข้อมูลล่าสุด", cls: "bg-green-50 text-green-700" }
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string }
}) {
  const page = parseInt(searchParams.page || "1")
  const search = searchParams.search || ""

  const where: any = {}
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ]
  }

  const [persons, total] = await Promise.all([
    prisma.person.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { id: "asc" },
      select: {
        id: true,
        nameTitle: true,
        firstName: true,
        lastName: true,
        currentPositionName: true,
        currentPositionType: true,
        currentPositionLevel: true,
        currentBureau: true,
        isActive: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.person.count({ where }),
  ])

  // Stale count batch
  const ids = persons.map((p) => p.id)
  const staleCounts = await prisma.order.groupBy({
    by: ["employeeId"],
    where: {
      employeeId: { in: ids },
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
    _count: { id: true },
  })
  const staleMap = new Map(staleCounts.map((s) => [s.employeeId, s._count.id]))

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">👥 ข้าราชการทั้งหมด</h1>

      {/* Search */}
      <form className="mb-4 flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="ค้นหาชื่อ-นามสกุล..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          ค้นหา
        </button>
      </form>

      <p className="text-sm text-zinc-500 mb-4">
        ทั้งหมด {total} คน | หน้า {page} / {totalPages || 1}
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="text-left p-3 text-sm font-medium">#</th>
              <th className="text-left p-3 text-sm font-medium">ชื่อ-สกุล</th>
              <th className="text-left p-3 text-sm font-medium">ตำแหน่ง</th>
              <th className="text-left p-3 text-sm font-medium">สังกัด</th>
              <th className="text-center p-3 text-sm font-medium">คำสั่ง</th>
              <th className="text-left p-3 text-sm font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => {
              const stale = staleMap.get(p.id) ?? 0
              const badge = statusBadge(p.isActive, stale)
              return (
                <tr key={p.id} className="border-b hover:bg-zinc-50">
                  <td className="p-3 text-sm font-mono text-zinc-400">{p.id}</td>
                  <td className="p-3">
                    <Link
                      href={`/employees/${p.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {p.nameTitle} {p.firstName} {p.lastName}
                    </Link>
                  </td>
                  <td className="p-3 text-sm">
                    {p.currentPositionName || "—"}
                    <div className="text-xs text-zinc-400">
                      {p.currentPositionType} / {p.currentPositionLevel}
                    </div>
                  </td>
                  <td className="p-3 text-sm">{p.currentBureau || "—"}</td>
                  <td className="p-3 text-center text-sm">{p._count.orders}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {page > 1 && (
          <Link
            href={`/employees?page=${page - 1}${search ? `&search=${search}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ← ก่อนหน้า
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={`/employees?page=${page + 1}${search ? `&search=${search}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd /opt/data/work/01-projects/gen-ai/salary-audit && npm run dev
# Visit: http://localhost:3000/employees
```

Expected: Table with person rows, search form, pagination, status badges

**Step 3: Commit**

```bash
git add app/employees/
git commit -m "feat: employee list page with search, pagination, stale badges"
```

---

## Task 10: /employees/[id] — Employee detail page (snapshot + timeline + change log)

**Objective:** Deep dive into one employee

**Files:**
- Create: `app/employees/[id]/page.tsx`

**Step 1: Create the page**

```typescript
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

const typeLabel: Record<string, string> = {
  salary_apr: "เลื่อนเงินเดือน 1 เม.ย.",
  salary_oct: "เลื่อนเงินเดือน 1 ต.ค.",
  special_salary: "เลื่อนพิเศษ",
  promotion: "เลื่อนตำแหน่ง",
  transfer: "ย้าย",
  transfer_in: "รับโอน",
  transfer_out: "โอนออก",
  resign: "ลาออก",
  retire: "เกษียณ",
  other: "อื่นๆ",
}

const changeLabel: Record<string, string> = {
  salary: "เงินเดือน",
  position: "ตำแหน่ง",
  level: "ระดับ",
  type: "ประเภท",
  org: "สังกัด",
  qualification: "วุฒิการศึกษา",
  status: "สถานะ",
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const id = parseInt(params.id)

  const person = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      nameTitle: true,
      firstName: true,
      lastName: true,
      citizenId: true,
      currentPositionName: true,
      currentPositionType: true,
      currentPositionLevel: true,
      currentBureau: true,
      currentDivision: true,
      currentDepartment: true,
      currentMinistry: true,
      currentSalary: true,
      salarySystemType: true,
      currentQualification: true,
      qualificationEffectiveDate: true,
      isActive: true,
      _count: { select: { orders: true, changeLogs: true } },
    },
  })

  if (!person) notFound()

  // Orders timeline
  const orders = await prisma.order.findMany({
    where: { employeeId: id },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      salary: true,
      positionName: true,
    },
  })

  // Change log (last 20)
  const changes = await prisma.employeeChangeLog.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      changeType: true,
      effectiveDate: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      order: {
        select: { id: true, orderNo: true, orderType: true },
      },
    },
  })

  // Stale count
  const staleCount = await prisma.order.count({
    where: {
      employeeId: id,
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
  })

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-400">
        <Link href="/employees" className="hover:underline">ข้าราชการ</Link>
        {" / "}
        <span className="text-zinc-700">{person.firstName} {person.lastName}</span>
      </div>

      {/* Snapshot Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {person.nameTitle} {person.firstName} {person.lastName}
            </h1>
            {person.citizenId && (
              <p className="text-sm text-zinc-400 font-mono mt-1">
                เลขบัตร: {person.citizenId}
              </p>
            )}
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full ${
              person.isActive
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {person.isActive ? "🟢 ประจำการ" : "⚪ ไม่ประจำการ"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="ตำแหน่ง" value={person.currentPositionName} />
          <Field label="ระดับ" value={person.currentPositionLevel} />
          <Field label="ประเภท" value={person.currentPositionType} />
          <Field label="สังกัด" value={person.currentBureau} />
          <Field label="กอง/แผนก" value={person.currentDepartment} />
          <Field
            label="เงินเดือน"
            value={
              person.currentSalary
                ? `${person.currentSalary.toLocaleString()} บาท`
                : undefined
            }
          />
          <Field label="วุฒิการศึกษา" value={person.currentQualification} />
          <Field label="สถานะข้อมูล" value={staleCount > 0 ? `🔴 ${staleCount} คำสั่ง stale` : "🟢 ล่าสุด"} />
        </div>
      </div>

      {/* Order Timeline */}
      <div>
        <h2 className="text-lg font-bold mb-4">📋 ประวัติคำสั่ง ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-zinc-400 text-sm">ยังไม่มีคำสั่ง</p>
        ) : (
          <div className="space-y-1">
            {orders.map((o) => {
              const isStale =
                o.statusSalary === "stale" ||
                o.statusLevel === "stale" ||
                o.statusPosition === "stale" ||
                o.statusType === "stale" ||
                o.statusOrg === "stale"
              const isCorrected = o.orderStatus === "superseded"
              const icon = isCorrected ? "🔄" : isStale ? "⚠️" : "✅"
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                >
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {typeLabel[o.orderType] || o.orderType}
                      {o.positionName && ` — ${o.positionName}`}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {o.effectiveDate} | {o.orderNo || "ไม่มีเลขที่"}
                    </p>
                  </div>
                  {o.salary && (
                    <span className="text-sm font-mono text-zinc-500">
                      {o.salary.toLocaleString()} บ.
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Change Log */}
      <div>
        <h2 className="text-lg font-bold mb-4">📝 ประวัติการเปลี่ยนแปลง</h2>
        {changes.length === 0 ? (
          <p className="text-zinc-400 text-sm">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">วันที่</th>
                  <th className="text-left p-3 text-sm font-medium">ฟิลด์</th>
                  <th className="text-left p-3 text-sm font-medium">ค่าเก่า</th>
                  <th className="text-left p-3 text-sm font-medium">ค่าใหม่</th>
                  <th className="text-left p-3 text-sm font-medium">คำสั่ง</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id} className="border-b text-sm">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("th-TH")}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-zinc-100 rounded text-xs">
                        {changeLabel[c.changeType] || c.changeType}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-500">{c.oldValue || "—"}</td>
                    <td className="p-3 font-medium">{c.newValue || "—"}</td>
                    <td className="p-3">
                      {c.order ? (
                        <Link
                          href={`/orders/${c.order.id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {c.order.orderNo || `#${c.order.id}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {person._count.changeLogs > 20 && (
          <p className="text-xs text-zinc-400 mt-2">
            แสดง 20 รายการล่าสุด จากทั้งหมด {person._count.changeLogs} รายการ
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  )
}
```

**Step 2: Verify**

```bash
# Visit: http://localhost:3000/employees/1
```

Expected: Snapshot card, timeline list, change log table

**Step 3: Commit**

```bash
git add app/employees/
git commit -m "feat: employee detail page with snapshot, timeline, change log"
```

---

## Task 11: /dashboard — Consolidated dashboard (KPI + activity + stale summary)

**Objective:** Merge `/` (KPI) + `/dashboard/stale` into `/dashboard`, add activity feed

**Files:**
- Create: `app/dashboard/page.tsx`
- Modify: `app/page.tsx` (redirect to /dashboard)

**Step 1: Create the consolidated dashboard page**

```typescript
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const typeLabel: Record<string, string> = {
  salary_apr: "เลื่อนเงินเดือน 1 เม.ย.",
  salary_oct: "เลื่อนเงินเดือน 1 ต.ค.",
  promotion: "เลื่อนตำแหน่ง",
  transfer: "ย้าย",
}

export default async function DashboardPage() {
  // KPI counters
  const staleWhere = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusLevel: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusOrg: "stale" },
    ],
  }

  const [
    totalOrders,
    activeOrders,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({ where: staleWhere }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({ where: { status: { in: ["draft", "previewing", "previewed"] } } }),
    prisma.person.count({ where: { isActive: true } }),
  ])

  // Recent activity
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      effectiveDate: true,
      orderStatus: true,
      createdAt: true,
      person: { select: { firstName: true, lastName: true } },
    },
  })

  // Top stale orders (first page)
  const staleOrders = await prisma.order.findMany({
    where: staleWhere,
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    take: 20,
    select: {
      id: true,
      orderNo: true,
      orderType: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      person: { select: { firstName: true, lastName: true } },
    },
  })

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">📊 แผงควบคุม</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard label="คำสั่งทั้งหมด" value={totalOrders} href="/orders" />
        <KPICard label="Active" value={activeOrders} href="/orders?status=active" />
        <KPICard
          label="ต้องแก้ไข"
          value={staleCount}
          href="#stale"
          alert={staleCount > 0}
        />
        <KPICard label="ชุดคำสั่ง" value={totalBatches} href="/batches" />
        <KPICard label="รอดำเนินการ" value={pendingBatches} href="/batches" alert={pendingBatches > 0} />
        <KPICard label="ข้าราชการ" value={totalPersons} href="/employees" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/batches" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">📦 จัดการชุดคำสั่ง</Link>
        <Link href="#stale" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">🚨 ดูคำสั่งที่ต้องแก้ไข</Link>
        <Link href="/employees" className="bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700">👥 ข้าราชการ</Link>
      </div>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-bold mb-3">🕐 กิจกรรมล่าสุด</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium">วันที่</th>
                <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b hover:bg-zinc-50 text-sm">
                  <td className="p-3 text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  <td className="p-3">{typeLabel[o.orderType] || o.orderType}</td>
                  <td className="p-3">
                    <Link href={`/employees/${o.person.firstName}`} className="text-blue-600 hover:underline">
                      {o.person.firstName} {o.person.lastName}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs">{o.effectiveDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stale Orders */}
      <section id="stale">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">🚨 คำสั่งที่ต้องแก้ไข ({staleCount})</h2>
          <div className="flex gap-2">
            <a
              href="/api/reports/stale/export?format=xlsx"
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
            >
              📥 Excel
            </a>
            <a
              href="/api/reports/stale/export?format=csv"
              className="text-xs bg-zinc-600 text-white px-3 py-1.5 rounded hover:bg-zinc-700"
            >
              📥 CSV
            </a>
          </div>
        </div>

        {staleOrders.length === 0 ? (
          <p className="text-sm text-zinc-400">🎉 ไม่มีคำสั่งที่ต้องแก้ไข</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                  <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                  <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
                  <th className="text-left p-3 text-sm font-medium">ปัญหา</th>
                </tr>
              </thead>
              <tbody>
                {staleOrders.map((o) => {
                  const warnings: string[] = []
                  if (o.statusSalary === "stale") warnings.push("💰 เงินเดือน")
                  if (o.statusLevel === "stale") warnings.push("📊 ระดับ")
                  if (o.statusPosition === "stale") warnings.push("📋 ตำแหน่ง")
                  if (o.statusType === "stale") warnings.push("🏷️ ประเภท")
                  if (o.statusOrg === "stale") warnings.push("🏢 สังกัด")
                  return (
                    <tr key={o.id} className="border-b hover:bg-red-50 text-sm">
                      <td className="p-3">
                        {o.person.firstName} {o.person.lastName}
                      </td>
                      <td className="p-3">{typeLabel[o.orderType] || o.orderType}</td>
                      <td className="p-3 font-mono text-xs">{o.effectiveDate}</td>
                      <td className="p-3">
                        <span className="text-red-600 text-xs">
                          {warnings.join(", ")}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {staleCount > 20 && (
          <p className="text-xs text-zinc-400 mt-2">
            แสดง 20 รายการ จากทั้งหมด {staleCount} รายการ
          </p>
        )}
      </section>
    </div>
  )
}

function KPICard({
  label,
  value,
  href,
  alert,
}: {
  label: string
  value: number
  href: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl p-4 shadow-sm border transition-colors hover:shadow-md ${
        alert ? "bg-red-50 border-red-200" : "bg-white"
      }`}
    >
      <div className={`text-2xl font-bold ${alert ? "text-red-700" : "text-zinc-900"}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-zinc-500 mt-1">{label}</div>
    </Link>
  )
}
```

**Step 2: Update / to redirect**

```typescript
// app/page.tsx — replace entire content
import { redirect } from "next/navigation"
export default function Home() {
  redirect("/dashboard")
}
```

**Step 3: Verify**

```bash
# Visit: http://localhost:3000/dashboard
# Visit: http://localhost:3000/ → should redirect to /dashboard
```

Expected: KPI cards, activity feed, stale orders table with export buttons

**Step 4: Commit**

```bash
git add app/dashboard/ app/page.tsx
git commit -m "feat: consolidated dashboard with KPI, activity, stale summary, export buttons"
```

---

## Task 12: /reports/audit — Audit trail page

**Objective:** Filterable audit trail report

**Files:**
- Create: `app/reports/audit/page.tsx`

**Step 1: Create the page**

```typescript
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const PAGE_SIZE = 50

const changeLabel: Record<string, string> = {
  salary: "💰 เงินเดือน",
  position: "📋 ตำแหน่ง",
  level: "📊 ระดับ",
  type: "🏷️ ประเภท",
  org: "🏢 สังกัด",
  qualification: "🎓 วุฒิ",
  status: "📌 สถานะ",
}

export default async function AuditReportPage({
  searchParams,
}: {
  searchParams: {
    page?: string
    search?: string
    changeType?: string
    orderType?: string
    dateFrom?: string
    dateTo?: string
  }
}) {
  const page = parseInt(searchParams.page || "1")
  const search = searchParams.search || ""
  const changeType = searchParams.changeType || ""
  const orderType = searchParams.orderType || ""
  const dateFrom = searchParams.dateFrom || ""
  const dateTo = searchParams.dateTo || ""

  const where: any = {}
  if (search) {
    where.person = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    }
  }
  if (changeType) where.changeType = changeType
  if (orderType) where.order = { orderType }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z")
  }

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        person: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { id: true, orderNo: true, orderType: true, effectiveDate: true } },
      },
    }),
    prisma.employeeChangeLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const queryString = (extra: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ search, changeType, orderType, dateFrom, dateTo, ...extra })) {
      if (v) p.set(k, v)
    }
    return p.toString()
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📜 ประวัติการเปลี่ยนแปลง (Audit Trail)</h1>

      {/* Filters */}
      <form className="mb-6 p-4 bg-white rounded-lg border space-y-3">
        <div className="flex gap-2 flex-wrap">
          <input
            name="search"
            defaultValue={search}
            placeholder="ค้นหาชื่อ..."
            className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[150px]"
          />
          <select name="changeType" defaultValue={changeType} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">ทุกประเภทการเปลี่ยน</option>
            {Object.entries(changeLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="px-3 py-2 border rounded-lg text-sm"
            placeholder="ตั้งแต่"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="px-3 py-2 border rounded-lg text-sm"
            placeholder="ถึง"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            กรอง
          </button>
          <Link href="/reports/audit" className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
            ล้าง
          </Link>
        </div>
      </form>

      <p className="text-sm text-zinc-500 mb-4">
        ทั้งหมด {total} รายการ | หน้า {page} / {totalPages || 1}
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="text-left p-3 text-sm font-medium">วันที่</th>
              <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
              <th className="text-left p-3 text-sm font-medium">ฟิลด์</th>
              <th className="text-left p-3 text-sm font-medium">ค่าเก่า</th>
              <th className="text-left p-3 text-sm font-medium">ค่าใหม่</th>
              <th className="text-left p-3 text-sm font-medium">คำสั่ง</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.id} className="border-b hover:bg-zinc-50 text-sm">
                <td className="p-3 text-zinc-500 whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleDateString("th-TH")}
                </td>
                <td className="p-3">
                  <Link
                    href={`/employees/${c.person.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {c.person.firstName} {c.person.lastName}
                  </Link>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-zinc-100 rounded text-xs">
                    {changeLabel[c.changeType] || c.changeType}
                  </span>
                </td>
                <td className="p-3 text-zinc-500 font-mono text-xs">{c.oldValue || "—"}</td>
                <td className="p-3 font-medium font-mono text-xs">{c.newValue || "—"}</td>
                <td className="p-3">
                  {c.order ? (
                    <Link
                      href={`/orders/${c.order.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      #{c.order.id}
                    </Link>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {page > 1 && (
          <Link href={`/reports/audit?${queryString({ page: String(page - 1) })}`} className="px-3 py-1 text-sm border rounded hover:bg-zinc-100">
            ← ก่อนหน้า
          </Link>
        )}
        {page < totalPages && (
          <Link href={`/reports/audit?${queryString({ page: String(page + 1) })}`} className="px-3 py-1 text-sm border rounded hover:bg-zinc-100">
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
# Visit: http://localhost:3000/reports/audit
```

Expected: Filterable table with change logs

**Step 3: Commit**

```bash
git add app/reports/
git commit -m "feat: audit trail report with filters"
```

---

## Task 13: Navigation update + redirects

**Objective:** Update layout nav to reflect new structure

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Update nav**

Replace the nav section in `app/layout.tsx`:

```tsx
<nav className="border-b bg-white sticky top-0 z-10">
  <div className="max-w-5xl mx-auto flex items-center gap-6 px-6 h-12 text-sm">
    <Link href="/dashboard" className="font-bold text-zinc-900">Salary Audit</Link>
    <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">📊 แผงควบคุม</Link>
    <Link href="/employees" className="text-zinc-600 hover:text-zinc-900">👥 ข้าราชการ</Link>
    <Link href="/orders" className="text-zinc-600 hover:text-zinc-900">📋 คำสั่ง</Link>
    <Link href="/batches" className="text-zinc-600 hover:text-zinc-900">📦 ชุดคำสั่ง</Link>
    <Link href="/reports/audit" className="text-zinc-600 hover:text-zinc-900">📜 Audit</Link>
    <div className="flex-1" />
    <Link href="/login" className="text-zinc-400 hover:text-zinc-600 text-xs">เข้าสู่ระบบ</Link>
  </div>
</nav>
```

**Step 2: Verify**

```bash
# Visit: http://localhost:3000
# All nav links should work
```

Expected: Nav with Dashboard, Employees, Orders, Batches, Audit links

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: update nav with new dashboard and employee links"
```

---

## Task 14: Cleanup — Remove old pages

**Objective:** Remove old `/dashboard/stale` page (merged into /dashboard)

**Files:**
- Delete: `app/dashboard/stale/page.tsx`

**Step 1: Remove old stale page**

```bash
rm -rf app/dashboard/stale
```

**Step 2: Verify**

```bash
# Visit: http://localhost:3000/dashboard/stale → 404 (expected)
```

**Step 3: Commit**

```bash
git add app/dashboard/
git commit -m "chore: remove old stale dashboard page, merged into /dashboard"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `GET /api/employees?search=xxx` returns filtered persons
- [ ] `GET /api/employees/1` returns snapshot with staleCount
- [ ] `GET /api/employees/1/orders` returns timeline with overall field
- [ ] `GET /api/employees/1/changes` returns change log
- [ ] `GET /api/dashboard/activity` returns 10 recent orders
- [ ] `GET /api/dashboard/summary` returns KPI counters + staleByType
- [ ] `GET /api/reports/stale/export?format=xlsx` downloads Excel file
- [ ] `GET /api/reports/stale/export?format=csv` downloads CSV with Thai BOM
- [ ] `GET /api/reports/audit?changeType=salary` filters by change type
- [ ] `/employees` — search works, pagination works, click goes to detail
- [ ] `/employees/1` — snapshot card, timeline, change log all render
- [ ] `/dashboard` — KPI cards, activity feed, stale table, export buttons
- [ ] `/` redirects to `/dashboard`
- [ ] `/reports/audit` — filters work, pagination works
- [ ] Nav links all go to correct pages
- [ ] `npm run build` passes

---

*PRP v1.0 — P3 Reports & Dashboard — 26 พ.ค. 2569*
