import { prisma } from "@/lib/prisma"
import Link from "next/link"

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    salary_apr: "เลื่อนเงินเดือน 1 เม.ย.",
    salary_oct: "เลื่อนเงินเดือน 1 ต.ค.",
    promotion: "เลื่อนตำแหน่ง",
    transfer: "ย้าย",
  }
  return map[t] || t
}

function healthBadge(b: {
  blockerOrders: number
  affectedOrders: number
  totalOrders: number
}): string {
  if (b.blockerOrders > 0) return "🔴 มี blocker"
  if (b.affectedOrders > 0) return "🟡 มีผลกระทบ"
  if (b.totalOrders === 0) return "⚪ ยังไม่มีคำสั่ง"
  return "🟢 ผ่านทั้งหมด"
}

export default async function BatchesPage() {
  const batches = await prisma.orderBatch.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📦 ชุดคำสั่ง (Batches)</h1>
        <Link
          href="/batches/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + สร้างชุดใหม่
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="text-left p-3 text-sm font-medium">เลขที่</th>
              <th className="text-left p-3 text-sm font-medium">ประเภท</th>
              <th className="text-left p-3 text-sm font-medium">วันที่มีผล</th>
              <th className="text-center p-3 text-sm font-medium">ทั้งหมด</th>
              <th className="text-center p-3 text-sm font-medium">ผ่าน</th>
              <th className="text-center p-3 text-sm font-medium">ต้องแก้</th>
              <th className="text-center p-3 text-sm font-medium">blocker</th>
              <th className="text-left p-3 text-sm font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b hover:bg-zinc-50">
                <td className="p-3">
                  <Link
                    href={`/batches/${b.id}`}
                    className="text-blue-600 hover:underline font-mono text-sm"
                  >
                    {b.batchNo}
                  </Link>
                </td>
                <td className="p-3 text-sm">{typeLabel(b.batchType)}</td>
                <td className="p-3 text-sm font-mono">{b.effectiveDate || "—"}</td>
                <td className="p-3 text-center text-sm">{b.totalOrders}</td>
                <td className="p-3 text-center text-sm text-green-600">{b.cleanOrders}</td>
                <td className="p-3 text-center text-sm text-amber-600">{b.affectedOrders}</td>
                <td className="p-3 text-center text-sm text-red-600">{b.blockerOrders}</td>
                <td className="p-3 text-sm">{healthBadge(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
