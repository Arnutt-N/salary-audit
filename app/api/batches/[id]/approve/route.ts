import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateOrderFreshness, cascadeStaleCheck } from "@/lib/freshness"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const batchId = parseInt(id)
    const { mode } = await request.json() as { mode: "all" | "clean" | "reject" }

    const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }
    if (batch.status !== "previewed") {
      return NextResponse.json(
        { error: "Batch must be in 'previewed' status to approve" },
        { status: 400 }
      )
    }

    if (mode === "reject") {
      await prisma.orderBatch.update({
        where: { id: batchId },
        data: { status: "cancelled" },
      })
      return NextResponse.json({ approved: 0, status: "cancelled" })
    }

    // Orders are still "draft" after preview — activate all or just clean ones
    const orders = await prisma.order.findMany({
      where: { batchId, orderStatus: "draft" },
      select: {
        id: true,
        employeeId: true,
        orderType: true,
        effectiveDate: true,
        statusSalary: true,
        statusLevel: true,
      },
    })

    let cascadeTotal = 0
    let approved = 0

    for (const order of orders) {
      // In "clean" mode, skip orders with any stale flag (blockers)
      if (mode === "clean") {
        const isStale =
          order.statusSalary === "stale" ||
          order.statusLevel === "stale"
        if (isStale) continue
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          orderStatus: "active",
          statusChangedAt: new Date(),
        },
      })
      await validateOrderFreshness(order.id)
      cascadeTotal += await cascadeStaleCheck(order.id)
      approved++
    }

    const newStatus = mode === "clean" && approved < orders.length
      ? "partial"
      : "approved"

    await prisma.orderBatch.update({
      where: { id: batchId },
      data: {
        status: newStatus,
        approvedAt: new Date(),
        cascadeTotal: { increment: cascadeTotal },
      },
    })

    return NextResponse.json({
      approved,
      remaining: orders.length - approved,
      cascadeAffected: cascadeTotal,
      status: newStatus,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Batch approval failed", detail: String(error) },
      { status: 500 }
    )
  }
}
