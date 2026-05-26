import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { StaleOrderWithPerson } from "@/lib/types"

const MAX_EXPORT = 5000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "csv"

  const orders = (await prisma.order.findMany({
    where: {
      orderStatus: { in: ["active", "superseded"] },
      OR: [
        { statusSalary: "stale" },
        { statusLevel: "stale" },
        { statusPosition: "stale" },
        { statusType: "stale" },
        { statusOrg: "stale" },
      ],
    },
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    take: MAX_EXPORT,
    select: {
      id: true,
      orderNo: true,
      orderType: true,
      issueDate: true,
      effectiveDate: true,
      orderStatus: true,
      statusSalary: true,
      statusLevel: true,
      statusPosition: true,
      statusType: true,
      statusOrg: true,
      person: {
        select: { firstName: true, lastName: true },
      },
    },
  })) as StaleOrderWithPerson[]

  const BOM = "\uFEFF"
  const header =
    "ลำดับ,ชื่อ-สกุล,เลขที่คำสั่ง,ประเภท,วันที่มีผล,สถานะคำสั่ง,stale_เงินเดือน,stale_ระดับ,stale_ตำแหน่ง,stale_ประเภท,stale_สังกัด\n"
  const rows = orders
    .map((o, i) =>
      [
        i + 1,
        `"${o.person?.firstName ?? ""} ${o.person?.lastName ?? ""}"`,
        o.orderNo ?? "",
        o.orderType,
        o.effectiveDate,
        o.orderStatus,
        o.statusSalary,
        o.statusLevel,
        o.statusPosition,
        o.statusType,
        o.statusOrg,
      ].join(",")
    )
    .join("\n")

  const filename =
    format === "csv" ? "stale-orders.csv" : "stale-orders.txt"
  const contentType =
    format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8"

  return new NextResponse(BOM + header + rows, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  })
}
