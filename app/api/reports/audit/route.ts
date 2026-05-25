import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""
  const changeType = searchParams.get("changeType") || ""
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""
  const orderType = searchParams.get("orderType") || ""

  const where: Record<string, unknown> = {}

  if (search) {
    where.person = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    }
  }
  if (changeType) where.changeType = changeType
  if (orderType) {
    where.order = { orderType }
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59.999Z")
    where.createdAt = createdAt
  }

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
        order: {
          select: {
            id: true,
            orderNo: true,
            orderType: true,
            effectiveDate: true,
          },
        },
      },
    }),
    prisma.employeeChangeLog.count({ where }),
  ])

  return NextResponse.json({ changes, total, page, limit: PAGE_SIZE })
}
