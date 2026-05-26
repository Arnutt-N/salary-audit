import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { PersonWithCount } from "@/lib/types"

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""
  const active = searchParams.get("active")

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ]
  }
  if (active === "true") where.isActive = true
  if (active === "false") where.isActive = false

  const persons = (await prisma.person.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: { id: "asc" },
    select: {
      id: true,
      nameTitle: true,
      firstName: true,
      lastName: true,
      citizenId: true,
      currentPositionName: true,
      currentPositionType: true,
      currentPositionLevel: true,
      currentBureau: true,
      currentDivision: true,
      currentDepartment: true,
      currentMinistry: true,
      currentSalary: true,
      isActive: true,
      _count: { select: { orders: true } },
    },
  })) as PersonWithCount[]
  const total = await prisma.person.count({ where })

  // Avoid groupBy (Prisma 7 libSQL compatibility) — fetch stale counts in one query
  const personIds = persons.map((p) => p.id)
  const staleOrders =
    personIds.length > 0
      ? await prisma.order.findMany({
          where: {
            employeeId: { in: personIds },
            orderStatus: { in: ["active", "superseded"] },
            OR: [
              { statusSalary: "stale" },
              { statusLevel: "stale" },
              { statusPosition: "stale" },
              { statusType: "stale" },
              { statusOrg: "stale" },
            ],
          },
          select: { employeeId: true, id: true },
        })
      : []

  // Manual group count
  const staleMap = new Map<number, number>()
  for (const o of staleOrders) {
    staleMap.set(o.employeeId, (staleMap.get(o.employeeId) ?? 0) + 1)
  }

  const enriched = persons.map((p) => ({
    id: p.id,
    nameTitle: p.nameTitle,
    firstName: p.firstName,
    lastName: p.lastName,
    citizenId: p.citizenId,
    currentPositionName: p.currentPositionName,
    currentPositionType: p.currentPositionType,
    currentPositionLevel: p.currentPositionLevel,
    currentBureau: p.currentBureau,
    currentDivision: p.currentDivision,
    currentDepartment: p.currentDepartment,
    currentMinistry: p.currentMinistry,
    currentSalary: p.currentSalary,
    isActive: p.isActive,
    orderCount: p._count.orders,
    staleCount: staleMap.get(p.id) ?? 0,
  }))

  return NextResponse.json({ persons: enriched, total, page, limit: PAGE_SIZE })
}
