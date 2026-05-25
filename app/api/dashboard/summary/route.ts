import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const staleWhere = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusLevel: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusOrg: "stale" },
    ],
  }

  const [
    totalOrders,
    totalActive,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
    salaryStale,
    levelStale,
    positionStale,
    typeStale,
    orgStale,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({ where: staleWhere }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({
      where: { status: { in: ["draft", "previewing", "previewed"] } },
    }),
    prisma.person.count({ where: { isActive: true } }),
    prisma.order.count({
      where: { orderStatus: { in: ["active", "superseded"] }, statusSalary: "stale" },
    }),
    prisma.order.count({
      where: { orderStatus: { in: ["active", "superseded"] }, statusLevel: "stale" },
    }),
    prisma.order.count({
      where: { orderStatus: { in: ["active", "superseded"] }, statusPosition: "stale" },
    }),
    prisma.order.count({
      where: { orderStatus: { in: ["active", "superseded"] }, statusType: "stale" },
    }),
    prisma.order.count({
      where: { orderStatus: { in: ["active", "superseded"] }, statusOrg: "stale" },
    }),
  ])

  return NextResponse.json({
    totalOrders,
    totalActive,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
    staleByType: {
      salary: salaryStale,
      level: levelStale,
      position: positionStale,
      type: typeStale,
      org: orgStale,
    },
  })
}
