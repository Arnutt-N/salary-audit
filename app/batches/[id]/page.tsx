import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { BatchActions } from "./BatchActions"

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const batch = await prisma.orderBatch.findUnique({
    where: { id: parseInt(id) },
    include: {
      orders: {
        select: {
          id: true,
          orderNo: true,
          orderType: true,
          effectiveDate: true,
          orderStatus: true,
          statusSalary: true,
          statusLevel: true,
          statusOrg: true,
          person: { select: { firstName: true, lastName: true } },
        },
        orderBy: { effectiveDate: "desc" },
      },
    },
  })

  if (!batch) notFound()

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">📦 {batch.batchNo}</h1>
      <p className="text-zinc-500 mb-4">{batch.description || "—"}</p>

      <div className="grid grid-cols-6 gap-4 mb-6">
        <Stat label="ทั้งหมด" value={batch.totalOrders} />
        <Stat label="✅ ผ่าน" value={batch.cleanOrders} color="text-green-600" />
        <Stat label="⚠️ กระทบ" value={batch.affectedOrders} color="text-amber-600" />
        <Stat label="🔴 Blocker" value={batch.blockerOrders} color="text-red-600" />
        <Stat label="🔗 Cascade" value={batch.cascadeTotal} />
        <Stat label="สถานะ" value={batch.status} />
      </div>

      <BatchActions
        batchId={batch.id}
        status={batch.status}
        hasBlockers={batch.blockerOrders > 0}
      />

      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">บุคคล</th>
              <th className="text-left p-2">ประเภท</th>
              <th className="text-left p-2">Effective</th>
              <th className="text-left p-2">สถานะ</th>
              <th className="text-left p-2">Freshness</th>
            </tr>
          </thead>
          <tbody>
            {batch.orders.map((o) => {
              const staleFlags = [
                o.statusSalary,
                o.statusLevel,
                o.statusOrg,
              ].filter((s) => s === "stale").length
              return (
                <tr key={o.id} className="border-b hover:bg-zinc-50">
                  <td className="p-2 font-mono">{o.id}</td>
                  <td className="p-2">
                    {o.person?.firstName} {o.person?.lastName}
                  </td>
                  <td className="p-2">{o.orderType}</td>
                  <td className="p-2 font-mono">{o.effectiveDate}</td>
                  <td className="p-2">{o.orderStatus}</td>
                  <td className="p-2">
                    {staleFlags > 0 ? `🔴 ${staleFlags} stale` : "🟢 ok"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  color = "text-zinc-900",
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}
