import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderType: true,
      orderNo: true,
      effectiveDate: true,
      orderStatus: true,
      createdAt: true,
      person: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  })

  return NextResponse.json({ orders })
}
