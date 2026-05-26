import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { EmployeeOrderResult } from "@/lib/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)

  const orders = (await prisma.order.findMany({
    where: { employeeId: id },
    orderBy: { effectiveDate: "desc" },
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      salary: true,
      positionName: true,
      positionType: true,
      positionLevel: true,
    },
  })) as EmployeeOrderResult[]

  const enriched = orders.map((o) => {
    const isStale =
      o.statusSalary === "stale" ||
      o.statusLevel === "stale" ||
      o.statusPosition === "stale" ||
      o.statusType === "stale" ||
      o.statusOrg === "stale"
    const isCorrected = o.orderStatus === "superseded"
    const overall = isCorrected ? "corrected" : isStale ? "stale" : "fresh"

    return { ...o, isStale, isCorrected, overall }
  })

  return NextResponse.json({ orders: enriched, total: orders.length })
}
