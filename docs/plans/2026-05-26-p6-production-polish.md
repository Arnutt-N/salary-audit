# P6 — Production Polish — Implementation Plan

## Goal
ปรับปรุงคุณภาพ production: form validation (Zod), table UX (TanStack), preview cleanup (cron), error tracking (Sentry)

## Constraints
- node_modules ต้อง reinstall ก่อน (`rm -rf node_modules && npm install`)
- Follow existing patterns: server components, Prisma direct, Tailwind + shadcn
- ทุก error message เป็นภาษาไทย
- Client components ใช้ `"use client"` + `useState`/`useForm`

---

## Tasks

### Task 1: Install Dependencies
**Command:**
```bash
rm -rf node_modules package-lock.json
npm install react-hook-form @hookform/resolvers zod @tanstack/react-table @sentry/nextjs
```
**Verify:** `ls node_modules/.bin/next && npx prisma generate`
**Note:** ถ้า node_modules ยังเสีย → reinstall ทั้งหมด

---

### Task 2: Create Zod Schemas
**File:** `lib/validation/order-schema.ts` (NEW)

```typescript
import { z } from "zod"

export const orderSchema = z.object({
  employeeId: z.number().positive("กรุณาเลือกข้าราชการ"),
  orderType: z.string().min(1, "กรุณาเลือกประเภทคำสั่ง"),
  orderNo: z.string().nullable().optional(),
  issueDate: z.string().min(1, "กรุณาระบุวันที่ลงคำสั่ง"),
  effectiveDate: z.string().min(1, "กรุณาระบุวันที่มีผล"),
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

export type OrderFormData = z.infer<typeof orderSchema>
```

**File:** `lib/validation/batch-schema.ts` (NEW)

```typescript
import { z } from "zod"

export const batchSchema = z.object({
  batchNo: z.string().min(1, "กรุณากรอกเลขที่ชุด"),
  batchType: z.string().min(1, "กรุณาเลือกประเภท"),
  effectiveDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export type BatchFormData = z.infer<typeof batchSchema>
```

**Verify:** TypeScript compiles without errors

---

### Task 3: Upgrade NewOrderForm — React Hook Form + Zod
**File:** `app/orders/new/NewOrderForm.tsx` (MODIFY)

**Changes:**
- Replace `useState` form state with `useForm<OrderFormData>` + `zodResolver(orderSchema)`
- Replace manual validation with Zod schema validation
- Replace `onChange` handlers with `register("fieldName")`
- Show Zod error messages under each field (Thai text)
- Keep employee search + preview logic as-is (not part of form state)

**Pattern:**
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { orderSchema, type OrderFormData } from "@/lib/validation/order-schema"

const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<OrderFormData>({
  resolver: zodResolver(orderSchema),
  defaultValues: { orderType: "salary_increase", ... }
})
```

**Verify:** Form shows Thai error messages on invalid submit

---

### Task 4: Upgrade EditOrderForm — React Hook Form + Zod
**File:** `app/orders/[id]/edit/EditOrderForm.tsx` (MODIFY)

**Changes:** Same pattern as Task 3 but with pre-populated `defaultValues` from `order` prop

**Verify:** Edit form shows validation errors, pre-populated fields work

---

### Task 5: Upgrade NewBatchForm — React Hook Form + Zod
**File:** `app/batches/new/NewBatchForm.tsx` (MODIFY)

**Changes:** Same pattern as Task 3 but with `batchSchema`

**Verify:** Batch form shows validation errors

---

### Task 6: Create DataTable Component
**File:** `components/shared/data-table.tsx` (NEW)

**Purpose:** Reusable TanStack Table wrapper

```typescript
"use client"

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
}

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="w-full">
        <thead className="bg-zinc-50 border-b">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="text-left p-3 text-sm font-medium cursor-pointer select-none hover:bg-zinc-100"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-zinc-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-3 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Verify:** Component compiles, can be imported

---

### Task 7: Upgrade Orders Table to TanStack
**File:** `app/orders/page.tsx` (MODIFY)

**Changes:**
- Extract columns definition using `createColumnHelper`
- Replace HTML `<table>` with `<DataTable columns={columns} data={orders} />`
- Keep server-side pagination + filters as-is (server component)
- Make DataTable a client component import

**Note:** Data still fetched server-side — only table rendering is client

**Verify:** Orders list sortable by clicking column headers

---

### Task 8: Upgrade Employees Table to TanStack
**File:** `app/employees/page.tsx` (MODIFY)

**Changes:** Same pattern as Task 7

---

### Task 9: Upgrade Remaining Tables to TanStack
**Files:**
- `app/batches/page.tsx` (MODIFY)
- `app/reports/stale/page.tsx` (MODIFY)
- `app/reports/audit/page.tsx` (MODIFY)

**Changes:** Same pattern as Task 7

---

### Task 10: Preview Cron Cleanup
**File:** `app/api/cron/cleanup-previews/route.ts` (NEW)

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const expired = await prisma.order.updateMany({
    where: {
      orderStatus: "preview",
      previewExpiresAt: { lt: new Date() },
    },
    data: { orderStatus: "cancelled" },
  })

  return NextResponse.json({
    cleaned: expired.count,
    timestamp: new Date().toISOString(),
  })
}
```

**File:** `vercel.json` (NEW)
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-previews",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Verify:** API returns `{ cleaned: 0 }` when no expired previews

---

### Task 11: Sentry Integration
**Files:**
- `sentry.client.config.ts` (NEW)
- `sentry.server.config.ts` (NEW)
- `instrumentation.ts` (NEW)
- `next.config.ts` (MODIFY — wrap with withSentryConfig)

**Note:** Sentry DSN via `SENTRY_DSN` env var — optional, works without it (no-op)

**Verify:** `npm run build` passes, no Sentry errors when DSN not set

---

### Task 12: Build + CI Verify
**Verify:**
- `npm run build` ผ่าน
- All forms show Thai validation errors
- All tables sortable
- Cron endpoint responds
- CI green

---

## Implementation Order

```
Task 1 (install deps) ── must be first
  │
Task 2 (Zod schemas) ── foundation for forms
  │
Task 3-5 (form upgrades) ── parallel (different files)
  │
Task 6 (DataTable component) ── foundation for tables
  │
Task 7-9 (table upgrades) ── parallel (different files)
  │
Task 10 (cron cleanup) ── independent
Task 11 (Sentry) ── independent
  │
Task 12 (build verify) ── final
```

## File Summary

| File | Action | Task |
|------|--------|------|
| `lib/validation/order-schema.ts` | NEW | 2 |
| `lib/validation/batch-schema.ts` | NEW | 2 |
| `components/shared/data-table.tsx` | NEW | 6 |
| `app/api/cron/cleanup-previews/route.ts` | NEW | 10 |
| `vercel.json` | NEW | 10 |
| `sentry.client.config.ts` | NEW | 11 |
| `sentry.server.config.ts` | NEW | 11 |
| `instrumentation.ts` | NEW | 11 |
| `app/orders/new/NewOrderForm.tsx` | MODIFY | 3 |
| `app/orders/[id]/edit/EditOrderForm.tsx` | MODIFY | 4 |
| `app/batches/new/NewBatchForm.tsx` | MODIFY | 5 |
| `app/orders/page.tsx` | MODIFY | 7 |
| `app/employees/page.tsx` | MODIFY | 8 |
| `app/batches/page.tsx` | MODIFY | 9 |
| `app/reports/stale/page.tsx` | MODIFY | 9 |
| `app/reports/audit/page.tsx` | MODIFY | 9 |
| `next.config.ts` | MODIFY | 11 |
| `package.json` | MODIFY | 1 |

## Verification Checklist
- [ ] `npm install` — all new deps installed
- [ ] Zod schemas compile without errors
- [ ] Order form — Thai validation errors on invalid submit
- [ ] Edit form — same validation + pre-populated fields
- [ ] Batch form — same validation
- [ ] Orders table — sortable columns
- [ ] Employees table — sortable columns
- [ ] Batches table — sortable columns
- [ ] Stale report table — sortable columns
- [ ] Audit table — sortable columns
- [ ] Cron endpoint — returns `{ cleaned: N }`
- [ ] Sentry — no errors when DSN not set
- [ ] `npm run build` — no errors
- [ ] CI green on push

---

*PRP v1.0 — P6 Production Polish — 26 พ.ค. 2569*
