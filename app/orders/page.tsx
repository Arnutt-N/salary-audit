import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { toThaiDate } from "@/lib/date-utils"

const PAGE_SIZE = 50

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

function freshnessBadge(order: {
  statusSalary: string
  statusPosition: string
  statusType: string
  statusLevel: string
  statusOrg: string
  orderStatus: string
}) {
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; type?: string; status?: string }
}) {
  const currentPage = parseInt(searchParams.page || "1")
  const search = searchParams.search || ""
  const type = searchParams.type || ""
  const status = searchParams.status || ""

  const where: Record<string, unknown> = {}
  if (type) where.orderType = type
  if (status) where.orderStatus = status
  if (search) {
    where.OR = [
      { orderNo: { contains: search } },
      { person: { is: { firstName: { contains: search } } } },
      { person: { is: { lastName: { contains: search } } } },
    ]
  }

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

  const queryString = (extra: Record<string, string>) => {
    const p = new URLSearchParams()
    const params = { search, type, status, ...extra }
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v)
    }
    return p.toString()
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📋 คำสั่งทั้งหมด</h1>
      </div>

      {/* Filters */}
      <form className="mb-4 p-4 bg-white rounded-lg border space-y-3">
        <div className="flex gap-2 flex-wrap items-end">
          <input
            name="search"
            defaultValue={search}
            placeholder="ค้นหาเลขที่/ชื่อ..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm min-w-[150px]"
          />
          <select name="type" defaultValue={type} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">ทุกประเภท</option>
            {Object.entries(typeLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">ทุกสถานะ</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            ค้นหา
          </button>
          <Link href="/orders" className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
            ล้าง
          </Link>
        </div>
      </form>

      <p className="text-sm text-zinc-500 mb-4">
        ทั้งหมด {total} คำสั่ง | หน้า {currentPage} / {totalPages || 1}
      </p>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">ยังไม่มีคำสั่ง</p>
          <p className="text-sm mt-1">เริ่มต้นด้วยการสร้างคำสั่งใหม่</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium">#</th>
                <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                <th className="text-left p-3 text-sm font-medium">เลขที่</th>
                <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
                <th className="text-left p-3 text-sm font-medium">สถานะ</th>
                <th className="text-left p-3 text-sm font-medium">Freshness</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const badge = freshnessBadge(o)
                return (
                  <tr key={o.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 text-sm font-mono text-zinc-400">{o.id}</td>
                    <td className="p-3 text-sm">{typeLabel[o.orderType] || o.orderType}</td>
                    <td className="p-3 text-sm">
                      <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline font-medium">
                        {o.orderNo || `#${o.id}`}
                      </Link>
                    </td>
                    <td className="p-3 text-sm">
                      <Link href={`/employees/${o.person?.id}`} className="text-blue-600 hover:underline">
                        {o.person?.firstName} {o.person?.lastName}
                      </Link>
                    </td>
                    <td className="p-3 text-sm font-mono">{toThaiDate(o.effectiveDate)}</td>
                    <td className="p-3 text-sm">
                      <span className="text-xs px-2 py-1 rounded-full bg-zinc-100">
                        {statusLabel[o.orderStatus] || o.orderStatus}
                      </span>
                    </td>
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
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {currentPage > 1 && (
          <Link
            href={`/orders?${queryString({ page: String(currentPage - 1) })}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ← ก่อนหน้า
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={`/orders?${queryString({ page: String(currentPage + 1) })}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
