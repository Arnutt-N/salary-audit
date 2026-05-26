import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { StaleTable, type StaleRow } from "./StaleTable"

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

export default async function StaleReportPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string }
}) {
  const currentPage = parseInt(searchParams.page || "1")
  const type = searchParams.type || ""
  const PAGE_SIZE = 50

  const where: Record<string, unknown> = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusLevel: "stale" },
      { statusOrg: "stale" },
    ],
  }
  if (type) where.orderType = type

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { effectiveDate: "desc" },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const tableData: StaleRow[] = orders.map((o: any) => ({
    id: o.id,
    orderType: o.orderType,
    personId: o.person?.id ?? null,
    personFirstName: o.person?.firstName ?? null,
    personLastName: o.person?.lastName ?? null,
    effectiveDate: o.effectiveDate,
    orderStatus: o.orderStatus,
    statusSalary: o.statusSalary,
    statusPosition: o.statusPosition,
    statusType: o.statusType,
    statusLevel: o.statusLevel,
    statusOrg: o.statusOrg,
  }))

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">🚨 คำสั่งที่ต้องแก้ไข</h1>

      {/* Filters */}
      <form className="mb-4 p-4 bg-white rounded-lg border">
        <div className="flex gap-2 items-end">
          <select name="type" defaultValue={type} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">ทุกประเภท</option>
            {Object.entries(typeLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            กรอง
          </button>
          <Link href="/reports/stale" className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
            ล้าง
          </Link>
          <div className="flex-1" />
          <a
            href={`/api/reports/stale/export?format=xlsx${type ? `&type=${type}` : ""}`}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50"
          >
            📥 Excel
          </a>
          <a
            href={`/api/reports/stale/export?format=csv${type ? `&type=${type}` : ""}`}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50"
          >
            📥 CSV
          </a>
        </div>
      </form>

      <p className="text-sm text-zinc-500 mb-4">
        พบ {total} คำสั่ง | หน้า {currentPage} / {totalPages || 1}
      </p>

      {tableData.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">🎉 ไม่มีคำสั่ง stale</p>
          <p className="text-sm mt-1">ข้อมูลทั้งหมดเป็นปัจจุบัน</p>
        </div>
      ) : (
        <StaleTable data={tableData} />
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {currentPage > 1 && (
          <Link
            href={`/reports/stale?page=${currentPage - 1}${type ? `&type=${type}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ← ก่อนหน้า
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={`/reports/stale?page=${currentPage + 1}${type ? `&type=${type}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
