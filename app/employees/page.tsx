import { prisma } from "@/lib/prisma"
import Link from "next/link"

const PAGE_SIZE = 50

function statusBadge(isActive: boolean, staleCount: number) {
  if (!isActive)
    return { label: "⚪ ไม่ประจำการ", cls: "bg-gray-100 text-gray-600" }
  if (staleCount > 0)
    return { label: "🔴 มีคำสั่ง stale", cls: "bg-red-50 text-red-700" }
  return { label: "🟢 ข้อมูลล่าสุด", cls: "bg-green-50 text-green-700" }
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string }
}) {
  const currentPage = parseInt(searchParams.page || "1")
  const search = searchParams.search || ""

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ]
  }

  const [persons, total] = await Promise.all([
    prisma.person.findMany({
      where,
      skip: (currentPage - 1) * PAGE_SIZE,
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

  // Stale count — findMany + manual count (avoids groupBy compatibility)
  const ids = persons.map((p) => p.id)
  const staleOrders =
    ids.length > 0
      ? await prisma.order.findMany({
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
          select: { employeeId: true, id: true },
        })
      : []

  const staleMap = new Map<number, number>()
  for (const o of staleOrders) {
    staleMap.set(o.employeeId, (staleMap.get(o.employeeId) ?? 0) + 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">👥 ข้าราชการทั้งหมด</h1>

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
        ทั้งหมด {total} คน | หน้า {currentPage} / {totalPages || 1}
      </p>

      {persons.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">ยังไม่มีข้อมูลข้าราชการ</p>
          <p className="text-sm mt-1">
            เริ่มต้นด้วยการเพิ่มข้อมูลข้าราชการในระบบ
          </p>
        </div>
      ) : (
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
                    <td className="p-3 text-sm font-mono text-zinc-400">
                      {p.id}
                    </td>
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
                    <td className="p-3 text-center text-sm">
                      {p._count.orders}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}
                      >
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
            href={`/employees?page=${currentPage - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ← ก่อนหน้า
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={`/employees?page=${currentPage + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
