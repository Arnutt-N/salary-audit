import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { BatchesTable, type BatchRow } from "./BatchesTable"

export default async function BatchesPage() {
  const batches = await prisma.orderBatch.findMany({
    orderBy: { createdAt: "desc" },
  })

  const tableData: BatchRow[] = (batches as any[]).map((b) => ({
    id: b.id,
    batchNo: b.batchNo,
    batchType: b.batchType,
    effectiveDate: b.effectiveDate,
    totalOrders: b.totalOrders,
    cleanOrders: b.cleanOrders,
    affectedOrders: b.affectedOrders,
    blockerOrders: b.blockerOrders,
  }))

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

      {tableData.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg">ยังไม่มีชุดคำสั่ง</p>
        </div>
      ) : (
        <BatchesTable data={tableData} />
      )}
    </div>
  )
}
