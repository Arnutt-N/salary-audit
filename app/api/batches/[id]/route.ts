import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const health =
    batch.blockerOrders > 0 ? "blocker"
    : batch.affectedOrders > 0 ? "warning"
    : "clean"

  return NextResponse.json({ ...batch, health })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const batch = await prisma.orderBatch.findUnique({ where: { id: parseInt(id) } })

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }
  if (batch.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft batches can be deleted" },
      { status: 400 }
    )
  }

  await prisma.orderBatch.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ deleted: true })
}
