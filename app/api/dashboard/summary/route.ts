import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const [
    totalOrders,
    totalActive,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({
      where: {
        orderStatus: { in: ["active", "superseded"] },
        OR: [
          { statusSalary: "stale" },
          { statusLevel: "stale" },
          { statusPosition: "stale" },
          { statusType: "stale" },
          { statusOrg: "stale" },
        ],
      },
    }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({ where: { status: { in: ["draft", "previewing", "previewed"] } } }),
    prisma.person.count({ where: { isActive: true } }),
  ])

  return NextResponse.json({
    totalOrders,
    totalActive,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
  })
}
