import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)

  const orders = await prisma.order.findMany({
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
  })

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
