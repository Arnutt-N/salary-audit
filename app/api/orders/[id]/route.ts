import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateOrderFreshness, cascadeStaleCheck } from "@/lib/freshness"

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

// PATCH /api/orders/[id]/status — lifecycle state transitions
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    let body: { status: string; supersededById?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const { status: newStatus, supersededById } = body

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Full transition map (§9.1 Lifecycle State Machine)
    const validTransitions: Record<string, string[]> = {
      draft: ["preview"],
      preview: ["active", "draft"],          // back to draft to edit
      active: ["cancelled", "superseded", "void"],
      cancelled: [],                          // terminal
      superseded: [],                         // terminal
      void: [],                               // terminal
    }

    const allowed = validTransitions[order.orderStatus] || []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${order.orderStatus}' to '${newStatus}'`,
          allowed,
        },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      orderStatus: newStatus,
      statusChangedAt: new Date(),
    }

    if (newStatus === "preview") {
      updateData.previewExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    // superseded → set corrected_by chain
    if (newStatus === "superseded" && supersededById) {
      updateData.correctedById = supersededById
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    // On activation, run freshness + cascade
    if (newStatus === "active") {
      await validateOrderFreshness(orderId)
      await cascadeStaleCheck(orderId)
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: "Status transition failed", detail: String(error) },
      { status: 500 }
    )
  }
}
