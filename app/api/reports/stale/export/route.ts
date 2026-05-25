import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const MAX_EXPORT = 5000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "csv"

  const orders = await prisma.order.findMany({
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
  })

  if (format === "csv") {
    const BOM = "\uFEFF"
    const header =
      "ลำดับ,ชื่อ-สกุล,เลขที่คำสั่ง,ประเภท,วันที่มีผล,สถานะคำสั่ง,stale_เงินเดือน,stale_ระดับ,stale_ตำแหน่ง,stale_ประเภท,stale_สังกัด\n"
    const rows = orders
      .map((o, i) =>
        [
          i + 1,
          `"${o.person.firstName ?? ""} ${o.person.lastName ?? ""}"`,
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

    return new NextResponse(BOM + header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=stale-orders.csv`,
      },
    })
  }

  // xlsx — requires exceljs, try dynamic import
  if (format === "xlsx") {
    try {
      const ExcelJS = await import("exceljs").then((m) => m.default ?? m)

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("คำสั่งที่ต้องแก้ไข")

      ws.columns = [
        { header: "ลำดับ", key: "index", width: 6 },
        { header: "ชื่อ-สกุล", key: "name", width: 25 },
        { header: "เลขที่คำสั่ง", key: "orderNo", width: 15 },
        { header: "ประเภท", key: "orderType", width: 12 },
        { header: "วันที่มีผล", key: "effectiveDate", width: 12 },
        { header: "สถานะคำสั่ง", key: "orderStatus", width: 12 },
        { header: "เงินเดือน stale", key: "statusSalary", width: 14 },
        { header: "ระดับ stale", key: "statusLevel", width: 14 },
        { header: "ตำแหน่ง stale", key: "statusPosition", width: 14 },
        { header: "ประเภท stale", key: "statusType", width: 14 },
        { header: "สังกัด stale", key: "statusOrg", width: 14 },
      ]

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]
        ws.addRow({
          index: i + 1,
          name: `${o.person.firstName ?? ""} ${o.person.lastName ?? ""}`,
          orderNo: o.orderNo,
          orderType: o.orderType,
          effectiveDate: o.effectiveDate,
          orderStatus: o.orderStatus,
          statusSalary: o.statusSalary,
          statusLevel: o.statusLevel,
          statusPosition: o.statusPosition,
          statusType: o.statusType,
          statusOrg: o.statusOrg,
        })
      }

      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      }

      const buffer = await wb.xlsx.writeBuffer()

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=stale-orders.xlsx`,
        },
      })
    } catch {
      // Fallback: return CSV with xlsx filename
      const BOM = "\uFEFF"
      const header =
        "ลำดับ,ชื่อ-สกุล,เลขที่คำสั่ง,ประเภท,วันที่มีผล,สถานะคำสั่ง,stale_เงินเดือน,stale_ระดับ,stale_ตำแหน่ง,stale_ประเภท,stale_สังกัด\n"
      const rows = orders
        .map((o, i) =>
          [
            i + 1,
            `"${o.person.firstName ?? ""} ${o.person.lastName ?? ""}"`,
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

      return new NextResponse(BOM + header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=stale-orders.csv`,
        },
      })
    }
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
}
