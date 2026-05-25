import { prisma } from "@/lib/prisma"
import Link from "next/link"

const PAGE_SIZE = 50

const fieldLabel: Record<string, string> = {
  salary: "💰 เงินเดือน",
  position: "📋 ตำแหน่ง",
  level: "📊 ระดับ",
  type: "🏷️ ประเภทตำแหน่ง",
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
  const currentPage = parseInt(searchParams.page || "1")
  const search = searchParams.search || ""
  const changeType = searchParams.changeType || ""
  const orderType = searchParams.orderType || ""
  const dateFrom = searchParams.dateFrom || ""
  const dateTo = searchParams.dateTo || ""

  const where: Record<string, unknown> = {}
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
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59.999Z")
    where.createdAt = createdAt
  }

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        person: { select: { id: true, firstName: true, lastName: true } },
        order: {
          select: { id: true, orderNo: true, orderType: true, effectiveDate: true },
        },
      },
    }),
    prisma.employeeChangeLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const queryString = (extra: Record<string, string>) => {
    const p = new URLSearchParams()
    const params = {
      search,
      changeType,
      orderType,
      dateFrom,
      dateTo,
      ...extra,
    }
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v)
    }
    return p.toString()
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        📜 ประวัติการเปลี่ยนแปลง (Audit Trail)
      </h1>

      {/* Filters */}
      <form className="mb-6 p-4 bg-white rounded-lg border space-y-3">
        <div className="flex gap-2 flex-wrap items-end">
          <input
            name="search"
            defaultValue={search}
            placeholder="ค้นหาชื่อ..."
            className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[150px]"
          />
          <select
            name="changeType"
            defaultValue={changeType}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">ทุกประเภทการเปลี่ยน</option>
            {Object.entries(fieldLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
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
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            กรอง
          </button>
          <Link
            href="/reports/audit"
            className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50"
          >
            ล้าง
          </Link>
        </div>
      </form>

      <p className="text-sm text-zinc-500 mb-4">
        ทั้งหมด {total} รายการ | หน้า {currentPage} / {totalPages || 1}
      </p>

      {changes.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
          <p className="text-sm mt-1">ลองเปลี่ยน filter หรือเพิ่มข้อมูลในระบบ</p>
        </div>
      ) : (
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
                      {fieldLabel[c.changeType] || c.changeType}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-500 font-mono text-xs">
                    {c.oldValue || "—"}
                  </td>
                  <td className="p-3 font-medium font-mono text-xs">
                    {c.newValue || "—"}
                  </td>
                  <td className="p-3">
                    {c.order ? (
                      <Link
                        href={`/orders/${c.order.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        #{c.order.id}
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

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-4">
        {currentPage > 1 && (
          <Link
            href={`/reports/audit?${queryString({ page: String(currentPage - 1) })}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ← ก่อนหน้า
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={`/reports/audit?${queryString({ page: String(currentPage + 1) })}`}
            className="px-3 py-1 text-sm border rounded hover:bg-zinc-100"
          >
            ถัดไป →
          </Link>
        )}
      </div>
    </div>
  )
}
