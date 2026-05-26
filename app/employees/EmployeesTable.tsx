"use client"

import { DataTable } from "@/components/shared/data-table"
import { createColumnHelper } from "@tanstack/react-table"
import Link from "next/link"

export type EmployeeRow = {
  id: number
  nameTitle: string | null
  firstName: string | null
  lastName: string | null
  currentPositionName: string | null
  currentPositionType: string | null
  currentPositionLevel: string | null
  currentBureau: string | null
  orderCount: number
  isActive: boolean
  staleCount: number
}

function statusBadge(isActive: boolean, staleCount: number) {
  if (!isActive)
    return { label: "⚪ ไม่ประจำการ", cls: "bg-gray-100 text-gray-600" }
  if (staleCount > 0)
    return { label: "🔴 มีคำสั่ง stale", cls: "bg-red-50 text-red-700" }
  return { label: "🟢 ข้อมูลล่าสุด", cls: "bg-green-50 text-green-700" }
}

const columnHelper = createColumnHelper<EmployeeRow>()

const columns = [
  columnHelper.accessor("id", {
    header: "#",
    cell: (info) => <span className="font-mono text-zinc-400">{info.getValue()}</span>,
  }),
  columnHelper.accessor("firstName", {
    header: "ชื่อ-สกุล",
    cell: (info) => {
      const row = info.row.original
      return (
        <Link href={`/employees/${row.id}`} className="text-blue-600 hover:underline font-medium">
          {row.nameTitle} {row.firstName} {row.lastName}
        </Link>
      )
    },
  }),
  columnHelper.accessor("currentPositionName", {
    header: "ตำแหน่ง",
    cell: (info) => {
      const row = info.row.original
      return (
        <>
          {info.getValue() || "—"}
          <div className="text-xs text-zinc-400">
            {row.currentPositionType} / {row.currentPositionLevel}
          </div>
        </>
      )
    },
  }),
  columnHelper.accessor("currentBureau", {
    header: "สังกัด",
    cell: (info) => info.getValue() || "—",
  }),
  columnHelper.accessor("orderCount", {
    header: "คำสั่ง",
    cell: (info) => <span className="text-center block">{info.getValue()}</span>,
  }),
  columnHelper.accessor("staleCount", {
    header: "สถานะ",
    cell: (info) => {
      const row = info.row.original
      const badge = statusBadge(row.isActive, info.getValue())
      return (
        <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      )
    },
  }),
]

export function EmployeesTable({ data }: { data: EmployeeRow[] }) {
  return <DataTable columns={columns} data={data} />
}
