import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateOrderFreshness, cascadeStaleCheck } from "@/lib/freshness"

// GET /api/orders — list orders
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const type = searchParams.get("type")
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (type) where.orderType = type
  if (status) where.orderStatus = status

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { effectiveDate: "desc" },
      include: { person: { select: { firstName: true, lastName: true } } },
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({ orders, total, page, limit })
}

// POST /api/orders — create new order
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const order = await prisma.order.create({
      data: {
        employeeId: body.employeeId,
        batchId: body.batchId ?? null,
        orderType: body.orderType,
        orderNo: body.orderNo ?? null,
        issueDate: body.issueDate,
        effectiveDate: body.effectiveDate,
        salary: body.salary ?? null,
        salaryAsOfDate: body.salaryAsOfDate ?? null,
        salarySystemType: body.salarySystemType ?? null,
        positionName: body.positionName ?? null,
        positionType: body.positionType ?? null,
        positionLevel: body.positionLevel ?? null,
        bureau: body.bureau ?? null,
        division: body.division ?? null,
        department: body.department ?? null,
        ministry: body.ministry ?? null,
        orderStatus: "active",
      },
    })

    // Run freshness check + cascade on activation
    await validateOrderFreshness(order.id)
    const cascadeCount = await cascadeStaleCheck(order.id)

    // Create change log
    await prisma.employeeChangeLog.create({
      data: {
        employeeId: body.employeeId,
        changeType: body.orderType === "salary_increase" || body.orderType === "special_salary"
          ? "salary"
          : body.orderType === "promotion"
          ? "level"
          : body.orderType === "transfer"
          ? "org"
          : "position",
        effectiveDate: body.effectiveDate,
        orderId: order.id,
        newValue: JSON.stringify({
          position_name: body.positionName,
          position_type: body.positionType,
          position_level: body.positionLevel,
          bureau: body.bureau,
          department: body.department,
          ministry: body.ministry,
        }),
      },
    })

    return NextResponse.json({ order, cascadeAffected: cascadeCount }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create order", detail: String(error) },
      { status: 500 }
    )
  }
}
