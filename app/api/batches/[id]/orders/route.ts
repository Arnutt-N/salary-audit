import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const CHUNK_SIZE = 50

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const batchId = parseInt(id)

    const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }
    if (batch.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add orders to draft batch" },
        { status: 400 }
      )
    }

    const { orders: orderData } = await request.json() as {
      orders: Array<{
        employeeId: number
        orderType: string
        orderNo?: string
        issueDate: string
        effectiveDate: string
        salary?: number
        salaryAsOfDate?: string
        positionName?: string
        positionType?: string
        positionLevel?: string
        bureau?: string
        division?: string
        department?: string
        ministry?: string
      }>
    }

    let created = 0

    // Chunked createMany to avoid SQLite lock contention
    for (let i = 0; i < orderData.length; i += CHUNK_SIZE) {
      const chunk = orderData.slice(i, i + CHUNK_SIZE)
      const result = await prisma.order.createMany({
        data: chunk.map((o) => ({
          employeeId: o.employeeId,
          batchId,
          orderType: o.orderType,
          orderNo: o.orderNo ?? null,
          issueDate: o.issueDate,
          effectiveDate: o.effectiveDate,
          salary: o.salary ?? null,
          salaryAsOfDate: o.salaryAsOfDate ?? null,
          positionName: o.positionName ?? null,
          positionType: o.positionType ?? null,
          positionLevel: o.positionLevel ?? null,
          bureau: o.bureau ?? null,
          division: o.division ?? null,
          department: o.department ?? null,
          ministry: o.ministry ?? null,
          orderStatus: "draft",
        })),
      })
      created += result.count
    }

    await prisma.orderBatch.update({
      where: { id: batchId },
      data: { totalOrders: { increment: created } },
    })

    return NextResponse.json({ created }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add orders", detail: String(error) },
      { status: 500 }
    )
  }
}
