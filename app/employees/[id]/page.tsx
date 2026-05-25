import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

const typeLabel: Record<string, string> = {
  salary_apr: "เลื่อนเงินเดือน 1 เม.ย.",
  salary_oct: "เลื่อนเงินเดือน 1 ต.ค.",
  special_salary: "เลื่อนพิเศษ",
  promotion: "เลื่อนตำแหน่ง",
  transfer: "ย้าย",
  transfer_in: "รับโอน",
  transfer_out: "โอนออก",
  resign: "ลาออก",
  retire: "เกษียณ",
  other: "อื่นๆ",
}

const fieldLabel: Record<string, string> = {
  salary: "💰 เงินเดือน",
  position: "📋 ตำแหน่ง",
  level: "📊 ระดับ",
  type: "🏷️ ประเภทตำแหน่ง",
  org: "🏢 สังกัด",
  qualification: "🎓 วุฒิการศึกษา",
  status: "📌 สถานะ",
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const id = parseInt(params.id)

  const person = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      nameTitle: true,
      firstName: true,
      lastName: true,
      citizenId: true,
      currentPositionName: true,
      currentPositionType: true,
      currentPositionLevel: true,
      currentBureau: true,
      currentDivision: true,
      currentDepartment: true,
      currentMinistry: true,
      currentSalary: true,
      salarySystemType: true,
      currentQualification: true,
      qualificationEffectiveDate: true,
      isActive: true,
      _count: { select: { orders: true, changeLogs: true } },
    },
  })

  if (!person) notFound()

  // Order timeline
  const orders = await prisma.order.findMany({
    where: { employeeId: id },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      salary: true,
      positionName: true,
    },
  })

  // Change log (last 20)
  const changes = await prisma.employeeChangeLog.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      changeType: true,
      effectiveDate: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      order: {
        select: { id: true, orderNo: true, orderType: true },
      },
    },
  })

  // Stale count
  const staleCount = await prisma.order.count({
    where: {
      employeeId: id,
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
  })

  const field = (label: string, value?: string | number | null) => (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium mt-0.5">
        {value != null ? String(value) : "—"}
      </p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-400">
        <Link href="/employees" className="hover:underline">
          ข้าราชการ
        </Link>
        {" / "}
        <span className="text-zinc-700">
          {person.firstName} {person.lastName}
        </span>
      </div>

      {/* Snapshot Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {person.nameTitle} {person.firstName} {person.lastName}
            </h1>
            {person.citizenId && (
              <p className="text-sm text-zinc-400 font-mono mt-1">
                เลขบัตร: {person.citizenId}
              </p>
            )}
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full ${
              person.isActive
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {person.isActive ? "🟢 ประจำการ" : "⚪ ไม่ประจำการ"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {field("ตำแหน่ง", person.currentPositionName)}
          {field("ระดับ", person.currentPositionLevel)}
          {field("ประเภท", person.currentPositionType)}
          {field("สังกัด", person.currentBureau)}
          {field("กอง/แผนก", person.currentDepartment)}
          {field(
            "เงินเดือน",
            person.currentSalary
              ? `${person.currentSalary.toLocaleString()} บาท`
              : undefined
          )}
          {field("วุฒิการศึกษา", person.currentQualification)}
          {field(
            "สถานะข้อมูล",
            staleCount > 0
              ? `🔴 มี ${staleCount} คำสั่งที่ข้อมูลไม่ตรง`
              : "🟢 ข้อมูลล่าสุดทั้งหมด"
          )}
        </div>
      </div>

      {/* Order Timeline */}
      <section>
        <h2 className="text-lg font-bold mb-4">
          📋 ประวัติคำสั่ง ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="text-zinc-400 text-sm">ยังไม่มีคำสั่ง</p>
        ) : (
          <div className="space-y-1">
            {orders.map((o) => {
              const isStale =
                o.statusSalary === "stale" ||
                o.statusLevel === "stale" ||
                o.statusPosition === "stale" ||
                o.statusType === "stale" ||
                o.statusOrg === "stale"
              const isCorrected = o.orderStatus === "superseded"
              const icon = isCorrected ? "🔄" : isStale ? "⚠️" : "✅"
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                >
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {typeLabel[o.orderType] || o.orderType}
                      {o.positionName ? ` — ${o.positionName}` : ""}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {o.effectiveDate} | {o.orderNo || "ไม่มีเลขที่"}
                    </p>
                  </div>
                  {o.salary && (
                    <span className="text-sm font-mono text-zinc-500 shrink-0">
                      {o.salary.toLocaleString()} บ.
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Change Log */}
      <section>
        <h2 className="text-lg font-bold mb-4">📝 ประวัติการเปลี่ยนแปลง</h2>
        {changes.length === 0 ? (
          <p className="text-zinc-400 text-sm">
            ยังไม่มีประวัติการเปลี่ยนแปลง
          </p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">วันที่</th>
                  <th className="text-left p-3 text-sm font-medium">ฟิลด์</th>
                  <th className="text-left p-3 text-sm font-medium">ค่าเก่า</th>
                  <th className="text-left p-3 text-sm font-medium">ค่าใหม่</th>
                  <th className="text-left p-3 text-sm font-medium">คำสั่ง</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id} className="border-b text-sm">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("th-TH")}
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
                          {c.order.orderNo || `#${c.order.id}`}
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
        {person._count.changeLogs > 20 && (
          <p className="text-xs text-zinc-400 mt-2">
            แสดง 20 รายการล่าสุด จากทั้งหมด {person._count.changeLogs} รายการ
          </p>
        )}
      </section>
    </div>
  )
}
