"use client"

import { DataTable } from "@/components/shared/data-table"
import { createColumnHelper } from "@tanstack/react-table"
import Link from "next/link"
import { toThaiDate } from "@/lib/date-utils"

export type OrderRow = {
  id: number
  orderType: string
  orderNo: string | null
  personId: number | null
  personFirstName: string | null
  personLastName: string | null
  effectiveDate: string | null
  orderStatus: string
  statusSalary: string
  statusPosition: string
  statusType: string
  statusLevel: string
  statusOrg: string
}

const typeLabel: Record<string, string> = {
  salary_increase: "💰 เลื่อนเงินเดือน",
  special_salary: "💰 เลื่อนพิเศษ",
  promotion: "📈 เลื่อนตำแหน่ง",
  transfer: "🔄 ย้าย",
  transfer_in: "📥 รับโอน",
  transfer_out: "📤 โอนออก",
  resign: "👋 ลาออก",
  retire: "🏁 เกษียณ",
  education_adjust: "🎓 ปรับวุฒิ",
  other: "📝 อื่นๆ",
}

const statusLabel: Record<string, string> = {
  draft: "📝 แบบร่าง",
  preview: "👁️ ตรวจสอบ",
  active: "✅ มีผล",
  cancelled: "🚫 เพิกถอน",
  superseded: "🔄 ถูกแทนที่",
  void: "⛔ โมฆะ",
}

function freshnessBadge(order: OrderRow) {
  if (order.orderStatus === "superseded") return { label: "🔴 ถูกแก้ไข", cls: "bg-red-50 text-red-700" }
  const isStale =
    order.statusSalary === "stale" ||
    order.statusPosition === "stale" ||
    order.statusType === "stale" ||
    order.statusLevel === "stale" ||
    order.statusOrg === "stale"
  if (isStale) return { label: "🟡 stale", cls: "bg-amber-50 text-amber-700" }
  return { label: "🟢 ล่าสุด", cls: "bg-green-50 text-green-700" }
}

const columnHelper = createColumnHelper<OrderRow>()

const columns = [
  columnHelper.accessor("id", {
    header: "#",
    cell: (info) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
  }),
  columnHelper.accessor("orderType", {
    header: "ประเภท",
    cell: (info) => typeLabel[info.getValue()] || info.getValue(),
  }),
  columnHelper.accessor("orderNo", {
    header: "เลขที่",
    cell: (info) => (
      <Link href={`/orders/${info.row.original.id}`} className="text-blue-600 hover:underline font-medium">
        {info.getValue() || `#${info.row.original.id}`}
      </Link>
    ),
  }),
  columnHelper.accessor("personFirstName", {
    header: "ข้าราชการ",
    cell: (info) => {
      const row = info.row.original
      return row.personId ? (
        <Link href={`/employees/${row.personId}`} className="text-blue-600 hover:underline">
          {row.personFirstName} {row.personLastName}
        </Link>
      ) : (
        "—"
      )
    },
  }),
  columnHelper.accessor("effectiveDate", {
    header: "วันที่มีผล",
    cell: (info) => <span className="font-mono">{toThaiDate(info.getValue())}</span>,
  }),
  columnHelper.accessor("orderStatus", {
    header: "สถานะ",
    cell: (info) => (
      <span className="text-xs px-2 py-1 rounded-full bg-zinc-100">
        {statusLabel[info.getValue()] || info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("statusSalary", {
    header: "Freshness",
    cell: (info) => {
      const badge = freshnessBadge(info.row.original)
      return (
        <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      )
    },
  }),
]

export function OrdersTable({ data }: { data: OrderRow[] }) {
  return <DataTable columns={columns} data={data} />
}
