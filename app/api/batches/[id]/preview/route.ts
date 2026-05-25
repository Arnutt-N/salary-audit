import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { previewImpact } from "@/lib/freshness"

const PREVIEW_CHUNK = 10 // Process 10 orders at a time to avoid SQLite timeout

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const batchId = parseInt(id)

  try {
    const batch = await prisma.orderBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    await prisma.orderBatch.update({
      where: { id: batchId },
      data: { status: "previewing" },
    })

    const orders = await prisma.order.findMany({
      where: { batchId, orderStatus: "draft" },
    })

    let cleanOrders = 0
    let affectedOrders = 0
    let blockerOrders = 0
    let cascadeTotal = 0
    const summaries: Array<{
      orderId: number
      isStale: boolean
      affectedCount: number
      blockerCount: number
    }> = []

    // Chunked processing to avoid timeout on large batches (350+ orders)
    for (let i = 0; i < orders.length; i += PREVIEW_CHUNK) {
      const chunk = orders.slice(i, i + PREVIEW_CHUNK)

      for (const order of chunk) {
        try {
          const preview = await previewImpact({
            employeeId: order.employeeId,
            orderType: order.orderType,
            effectiveDate: order.effectiveDate,
            salary: order.salary,
            salaryAsOfDate: order.salaryAsOfDate,
            positionName: order.positionName,
            positionType: order.positionType,
            positionLevel: order.positionLevel,
            bureau: order.bureau,
            division: order.division,
            department: order.department,
            ministry: order.ministry,
          })

          const isStale = preview.newOrderFreshness.overallStatus === "stale"
          const hasCancel = preview.byAction.cancel > 0
          const impactCount = preview.totalAffected

          if (isStale || hasCancel) {
            blockerOrders++
          } else if (impactCount > 0) {
            affectedOrders++
          } else {
            cleanOrders++
          }

          cascadeTotal += impactCount
          summaries.push({
            orderId: order.id,
            isStale: isStale,
            affectedCount: impactCount,
            blockerCount: hasCancel ? 1 : 0,
          })
        } catch {
          blockerOrders++
          summaries.push({
            orderId: order.id,
            isStale: true,
            affectedCount: 0,
            blockerCount: 1,
          })
        }
      }
    }

    const updatedBatch = await prisma.orderBatch.update({
      where: { id: batchId },
      data: {
        cleanOrders,
        affectedOrders,
        blockerOrders,
        cascadeTotal,
        previewedOrders: orders.length,
        status: "previewed",
        previewedAt: new Date(),
      },
    })

    return NextResponse.json({
      batch: updatedBatch,
      summary: {
        total: orders.length,
        clean: cleanOrders,
        affected: affectedOrders,
        blockers: blockerOrders,
        cascadeTotal,
      },
      orders: summaries,
    })
  } catch (error) {
    // On failure, revert to draft
    await prisma.orderBatch.update({
      where: { id: batchId },
      data: { status: "draft" },
    }).catch(() => {})
    return NextResponse.json(
      { error: "Batch preview failed", detail: String(error) },
      { status: 500 }
    )
  }
}
