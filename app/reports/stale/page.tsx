import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { toThaiDate } from "@/lib/date-utils"

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

      {orders.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">🎉 ไม่มีคำสั่ง stale</p>
          <p className="text-sm mt-1">ข้อมูลทั้งหมดเป็นปัจจุบัน</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium">#</th>
                <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
                <th className="text-left p-3 text-sm font-medium">ปัญหา</th>
                <th className="text-left p-3 text-sm font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const warnings: string[] = []
                if (o.statusSalary === "stale") warnings.push("💰 เงินเดือน")
                if (o.statusLevel === "stale") warnings.push("📊 ระดับ")
                if (o.statusPosition === "stale") warnings.push("📋 ตำแหน่ง")
                if (o.statusType === "stale") warnings.push("🏷️ ประเภท")
                if (o.statusOrg === "stale") warnings.push("🏢 สังกัด")
                return (
                  <tr key={o.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 text-sm font-mono text-zinc-400">{o.id}</td>
                    <td className="p-3 text-sm">
                      <Link href={`/employees/${o.person?.id}`} className="text-blue-600 hover:underline">
                        {o.person?.firstName} {o.person?.lastName}
                      </Link>
                    </td>
                    <td className="p-3 text-sm">{typeLabel[o.orderType] || o.orderType}</td>
                    <td className="p-3 text-sm font-mono">{toThaiDate(o.effectiveDate)}</td>
                    <td className="p-3 text-sm">
                      {warnings.map((w, i) => (
                        <span key={i} className="inline-block text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded mr-1 mb-0.5">
                          {w}
                        </span>
                      ))}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${o.orderStatus === "superseded" ? "bg-zinc-100 text-zinc-600" : "bg-red-50 text-red-700"}`}>
                        {o.orderStatus === "superseded" ? "🔄 ถูกแทนที่" : "🔴 ต้องแก้ไข"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
