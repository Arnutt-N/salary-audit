import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateOrderFreshness } from "@/lib/freshness"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id: parseInt(id) },
    include: {
      person: {
        select: { firstName: true, lastName: true, currentSalary: true, currentPositionName: true },
      },
      batch: { select: { batchNo: true, batchType: true } },
      corrected: { select: { id: true, orderNo: true, orderType: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Run freshness check on-load
  const freshness = await validateOrderFreshness(order.id)

  return NextResponse.json({ ...order, freshness })
}
