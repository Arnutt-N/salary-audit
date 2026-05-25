import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const where = {
    orderStatus: { in: ["active", "superseded"] },
    OR: [
      { statusSalary: "stale" },
      { statusLevel: "stale" },
      { statusPosition: "stale" },
      { statusType: "stale" },
      { statusOrg: "stale" },
    ],
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
      select: {
        id: true,
        orderNo: true,
        orderType: true,
        employeeId: true,
        issueDate: true,
        effectiveDate: true,
        orderStatus: true,
        statusSalary: true,
        statusLevel: true,
        statusPosition: true,
        statusType: true,
        statusOrg: true,
        person: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  const enriched = orders.map((o) => {
    const warnings: string[] = []
    if (o.statusSalary === "stale") warnings.push("⚠️ เงินเดือนไม่ล่าสุด")
    if (o.statusLevel === "stale") warnings.push("⚠️ ระดับตำแหน่งไม่ล่าสุด")
    if (o.statusPosition === "stale") warnings.push("⚠️ ชื่อตำแหน่งไม่ล่าสุด")
    if (o.statusType === "stale") warnings.push("⚠️ ประเภทตำแหน่งไม่ล่าสุด")
    if (o.statusOrg === "stale") warnings.push("⚠️ สังกัดไม่ล่าสุด")

    return {
      ...o,
      warnings,
      overallStatus:
        o.orderStatus === "superseded" ? "🔄 ถูกแทนที่"
        : "🔴 ต้องแก้ไข",
    }
  })

  return NextResponse.json({ orders: enriched, total, page, limit })
}
