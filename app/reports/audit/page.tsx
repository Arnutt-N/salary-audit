import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { AuditTable, type AuditRow } from "./AuditTable"

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

  const tableData: AuditRow[] = changes.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    changeType: c.changeType,
    oldValue: c.oldValue,
    newValue: c.newValue,
    personId: c.person.id,
    personFirstName: c.person.firstName,
    personLastName: c.person.lastName,
    orderId: c.order?.id ?? null,
    orderNo: c.order?.orderNo ?? null,
    orderType: c.order?.orderType ?? null,
  }))

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

      {tableData.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
          <p className="text-sm mt-1">ลองเปลี่ยน filter หรือเพิ่มข้อมูลในระบบ</p>
        </div>
      ) : (
        <AuditTable data={tableData} />
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
