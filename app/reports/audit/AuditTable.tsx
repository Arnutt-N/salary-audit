"use client"

import { DataTable } from "@/components/shared/data-table"
import { createColumnHelper } from "@tanstack/react-table"
import Link from "next/link"

export type AuditRow = {
  id: number
  createdAt: string
  changeType: string
  oldValue: string | null
  newValue: string | null
  personId: number
  personFirstName: string | null
  personLastName: string | null
  orderId: number | null
  orderNo: string | null
  orderType: string | null
}

const fieldLabel: Record<string, string> = {
  salary: "💰 เงินเดือน",
  position: "📋 ตำแหน่ง",
  level: "📊 ระดับ",
  type: "🏷️ ประเภทตำแหน่ง",
  org: "🏢 สังกัด",
  qualification: "🎓 วุฒิ",
  status: "📌 สถานะ",
}

const columnHelper = createColumnHelper<AuditRow>()

const columns = [
  columnHelper.accessor("createdAt", {
    header: "วันที่",
    cell: (info) => (
      <span className="text-zinc-500 whitespace-nowrap">
        {new Date(info.getValue()).toLocaleDateString("th-TH")}
      </span>
    ),
  }),
  columnHelper.accessor("personFirstName", {
    header: "ข้าราชการ",
    cell: (info) => {
      const row = info.row.original
      return (
        <Link href={`/employees/${row.personId}`} className="text-blue-600 hover:underline">
          {row.personFirstName} {row.personLastName}
        </Link>
      )
    },
  }),
  columnHelper.accessor("changeType", {
    header: "ฟิลด์",
    cell: (info) => (
      <span className="px-2 py-0.5 bg-zinc-100 rounded text-xs">
        {fieldLabel[info.getValue()] || info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("oldValue", {
    header: "ค่าเก่า",
    cell: (info) => <span className="text-zinc-500 font-mono text-xs">{info.getValue() || "—"}</span>,
  }),
  columnHelper.accessor("newValue", {
    header: "ค่าใหม่",
    cell: (info) => <span className="font-medium font-mono text-xs">{info.getValue() || "—"}</span>,
  }),
  columnHelper.accessor("orderId", {
    header: "คำสั่ง",
    cell: (info) => {
      const orderId = info.getValue()
      return orderId ? (
        <Link href={`/orders/${orderId}`} className="text-blue-600 hover:underline text-xs">
          #{orderId}
        </Link>
      ) : (
        "—"
      )
    },
  }),
]

export function AuditTable({ data }: { data: AuditRow[] }) {
  return <DataTable columns={columns} data={data} />
}
