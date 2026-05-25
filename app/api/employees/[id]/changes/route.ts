import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  const [changes, total] = await Promise.all([
    prisma.employeeChangeLog.findMany({
      where: { employeeId: id },
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
    prisma.employeeChangeLog.count({ where: { employeeId: id } }),
  ])

  return NextResponse.json({ changes, total, page, limit: PAGE_SIZE })
}
