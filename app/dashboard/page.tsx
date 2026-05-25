import { prisma } from "@/lib/prisma"
import Link from "next/link"

const typeLabel: Record<string, string> = {
  salary_apr: "เลื่อนเงินเดือน 1 เม.ย.",
  salary_oct: "เลื่อนเงินเดือน 1 ต.ค.",
  promotion: "เลื่อนตำแหน่ง",
  transfer: "ย้าย",
}

export default async function DashboardPage() {
  const staleWhere = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusLevel: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusOrg: "stale" },
    ],
  }

  const [
    totalOrders,
    activeOrders,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({ where: staleWhere }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({
      where: { status: { in: ["draft", "previewing", "previewed"] } },
    }),
    prisma.person.count({ where: { isActive: true } }),
  ])

  // Recent activity (10 most recent)
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      effectiveDate: true,
      orderStatus: true,
      createdAt: true,
      person: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // Stale orders (limited to 30 to avoid timeout — critical fix #2)
  const staleOrders = await prisma.order.findMany({
    where: staleWhere,
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    take: 30,
    select: {
      id: true,
      orderNo: true,
      orderType: true,
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">📊 แผงควบคุม</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card label="คำสั่งทั้งหมด" value={totalOrders} href="/orders" />
        <Card label="Active" value={activeOrders} href="/orders?status=active" />
        <Card
          label="ต้องแก้ไข"
          value={staleCount}
          href="#stale"
          alert={staleCount > 0}
        />
        <Card label="ชุดคำสั่ง" value={totalBatches} href="/batches" />
        <Card
          label="รอดำเนินการ"
          value={pendingBatches}
          href="/batches"
          alert={pendingBatches > 0}
        />
        <Card label="ข้าราชการ" value={totalPersons} href="/employees" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/batches"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          📦 จัดการชุดคำสั่ง
        </Link>
        <Link
          href="#stale"
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
        >
          🚨 ดูคำสั่งที่ต้องแก้ไข
        </Link>
        <Link
          href="/employees"
          className="bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700"
        >
          👥 ข้าราชการ
        </Link>
      </div>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-bold mb-3">🕐 กิจกรรมล่าสุด</h2>
        {recentOrders.length === 0 ? (
          <p className="text-zinc-400 text-sm">ยังไม่มีกิจกรรม</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">วันที่</th>
                  <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                  <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                  <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-zinc-50 text-sm">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("th-TH")}
                    </td>
                    <td className="p-3">{typeLabel[o.orderType] || o.orderType}</td>
                    <td className="p-3">
                      <Link
                        href={`/employees/${o.person.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {o.person.firstName} {o.person.lastName}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-xs">{o.effectiveDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stale Orders */}
      <section id="stale">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">
            🚨 คำสั่งที่ต้องแก้ไข ({staleCount})
          </h2>
          <div className="flex gap-2">
            <a
              href="/api/reports/stale/export?format=csv"
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
            >
              📥 CSV
            </a>
          </div>
        </div>

        {staleOrders.length === 0 ? (
          <p className="text-sm text-zinc-400">
            🎉 ไม่มีคำสั่งที่ต้องแก้ไข
          </p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">ข้าราชการ</th>
                  <th className="text-left p-3 text-sm font-medium">ประเภท</th>
                  <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
                  <th className="text-left p-3 text-sm font-medium">ปัญหา</th>
                </tr>
              </thead>
              <tbody>
                {staleOrders.map((o) => {
                  const warnings: string[] = []
                  if (o.statusSalary === "stale") warnings.push("💰 เงินเดือน")
                  if (o.statusLevel === "stale") warnings.push("📊 ระดับ")
                  if (o.statusPosition === "stale") warnings.push("📋 ตำแหน่ง")
                  if (o.statusType === "stale") warnings.push("🏷️ ประเภท")
                  if (o.statusOrg === "stale") warnings.push("🏢 สังกัด")
                  return (
                    <tr
                      key={o.id}
                      className="border-b hover:bg-red-50 text-sm"
                    >
                      <td className="p-3">
                        {o.person.firstName} {o.person.lastName}
                      </td>
                      <td className="p-3">
                        {typeLabel[o.orderType] || o.orderType}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {o.effectiveDate}
                      </td>
                      <td className="p-3">
                        <span className="text-red-600 text-xs">
                          {warnings.join(", ")}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {staleCount > 30 && (
          <p className="text-xs text-zinc-400 mt-2">
            แสดง 30 รายการ จากทั้งหมด {staleCount} รายการ —{" "}
            <a
              href="/api/reports/stale/export?format=csv"
              className="text-blue-600 hover:underline"
            >
              ดาวน์โหลดทั้งหมด (CSV)
            </a>
          </p>
        )}
      </section>
    </div>
  )
}

function Card({
  label,
  value,
  href,
  alert,
}: {
  label: string
  value: number
  href: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl p-4 shadow-sm border transition-colors hover:shadow-md ${
        alert ? "bg-red-50 border-red-200" : "bg-white"
      }`}
    >
      <div
        className={`text-2xl font-bold ${alert ? "text-red-700" : "text-zinc-900"}`}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-zinc-500 mt-1">{label}</div>
    </Link>
  )
}
