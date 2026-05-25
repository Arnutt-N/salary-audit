import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  const person = await prisma.person.findUnique({
    where: { id },
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
      salarySystemType: true,
      currentQualification: true,
      qualificationEffectiveDate: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true, changeLogs: true } },
    },
  })

  if (!person) {
    return NextResponse.json({ error: "ไม่พบบุคคลนี้" }, { status: 404 })
  }

  const staleCount = await prisma.order.count({
    where: {
      employeeId: id,
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _count, ...rest } = person

  return NextResponse.json({
    ...rest,
    orderCount: _count.orders,
    changeLogCount: _count.changeLogs,
    staleCount,
  })
}
