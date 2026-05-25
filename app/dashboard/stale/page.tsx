import { prisma } from "@/lib/prisma"
import Link from "next/link"

const typeLabel: Record<string, string> = {
  salary_increase: "เลื่อนเงินเดือน",
  special_salary: "เลื่อนเงินเดือนพิเศษ",
  promotion: "เลื่อนระดับ",
  transfer: "ย้าย",
  resign: "ลาออก",
  education_adjust: "ปรับวุฒิ",
}

export default async function StaleDashboardPage() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    select: {
      id: true,
      orderNo: true,
      orderType: true,
      employeeId: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      person: { select: { firstName: true, lastName: true } },
    },
  })

  const enriched = orders.map((o) => {
    const warnings: string[] = []
    if (o.statusSalary === "stale") warnings.push("⚠️ เงินเดือนไม่ล่าสุด")
    if (o.statusLevel === "stale") warnings.push("⚠️ ระดับตำแหน่งไม่ล่าสุด")
    if (o.statusPosition === "stale") warnings.push("⚠️ ชื่อตำแหน่งไม่ล่าสุด")
    if (o.statusType === "stale") warnings.push("⚠️ ประเภทตำแหน่งไม่ล่าสุด")
    if (o.statusOrg === "stale") warnings.push("⚠️ สังกัดไม่ล่าสุด")
    return {
      ...o,
      warnings,
      overallStatus:
        o.orderStatus === "superseded" ? "🔄 ถูกแทนที่" : "🔴 ต้องแก้ไข",
    }
  })

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">🚨 คำสั่งที่ต้องแก้ไข</h1>
      <p className="text-zinc-500 mb-6">
        พบ {orders.length} คำสั่งที่ข้อมูลไม่ตรงตามข้อเท็จจริง
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-red-50 border-b">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">บุคคล</th>
              <th className="text-left p-2">ประเภท</th>
              <th className="text-left p-2">Effective</th>
              <th className="text-left p-2">คำเตือน</th>
              <th className="text-left p-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((o) => (
              <tr key={o.id} className="border-b hover:bg-zinc-50">
                <td className="p-2 font-mono">
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {o.orderNo || `#${o.id}`}
                  </Link>
                </td>
                <td className="p-2">
                  {o.person?.firstName} {o.person?.lastName}
                </td>
                <td className="p-2">{typeLabel[o.orderType] || o.orderType}</td>
                <td className="p-2 font-mono">{o.effectiveDate}</td>
                <td className="p-2">
                  {o.warnings.map((w, i) => (
                    <span key={i} className="block text-xs text-red-700">
                      {w}
                    </span>
                  ))}
                </td>
                <td className="p-2">{o.overallStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
