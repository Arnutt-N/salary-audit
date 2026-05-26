import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { toThaiDate } from "@/lib/date-utils"

const typeLabel: Record<string, string> = {
  salary_increase: "💰 เลื่อนเงินเดือน",
  special_salary: "💰 เลื่อนพิเศษ",
  promotion: "📈 เลื่อนตำแหน่ง",
  transfer: "🔄 ย้าย",
  transfer_in: "📥 รับโอน",
  transfer_out: "📤 โอนออก",
  resign: "👋 ลาออก",
  retire: "🏁 เกษียณ",
  education_adjust: "🎓 ปรับวุฒิ",
  other: "📝 อื่นๆ",
}

const statusLabel: Record<string, string> = {
  draft: "📝 แบบร่าง",
  preview: "👁️ ตรวจสอบ",
  active: "✅ มีผล",
  cancelled: "🚫 เพิกถอน",
  superseded: "🔄 ถูกแทนที่",
  void: "⛔ โมฆะ",
}

function FreshnessBadge({ status, label }: { status: string; label: string }) {
  const cls =
    status === "stale"
      ? "bg-amber-50 text-amber-700"
      : status === "corrected"
      ? "bg-red-50 text-red-700"
      : "bg-green-50 text-green-700"
  const icon = status === "stale" ? "🟡" : status === "corrected" ? "🔴" : "🟢"
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>
      {icon} {label}
    </span>
  )
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const id = params.id
  const orderId = parseInt(id)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      person: {
        select: { id: true, firstName: true, lastName: true, currentPositionName: true },
      },
      batch: { select: { batchNo: true, batchType: true } },
    },
  })

  if (!order) notFound()

  // Fetch correctedFrom separately (plain Int field, not relation)
  const correctedFromOrder = order.correctedFrom
    ? await prisma.order.findUnique({
        where: { id: order.correctedFrom },
        select: { id: true, orderNo: true, orderType: true },
      })
    : null

  // Fetch orders that this order corrected (reverse lookup)
  const correctedOrders = await prisma.order.findMany({
    where: { correctedFrom: orderId },
    select: { id: true, orderNo: true, orderType: true },
  })

  const field = (label: string, value?: string | number | null) => (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value != null ? String(value) : "—"}</p>
    </div>
  )

  const canEdit = ["draft", "active"].includes(order.orderStatus)

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-400">
        <Link href="/orders" className="hover:underline">คำสั่ง</Link>
        {" / "}
        <span className="text-zinc-700">#{order.id} {order.orderNo || ""}</span>
      </div>

      {/* Order Info Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {typeLabel[order.orderType] || order.orderType}
            </h1>
            {order.orderNo && (
              <p className="text-sm text-zinc-500 mt-1">เลขที่: {order.orderNo}</p>
            )}
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-zinc-100">
            {statusLabel[order.orderStatus] || order.orderStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {field("วันที่ลงคำสั่ง", toThaiDate(order.issueDate))}
          {field("วันที่มีผล", toThaiDate(order.effectiveDate))}
          {field("เงินเดือน", order.salary ? `${order.salary.toLocaleString()} บาท` : null)}
          {field("เงินเดือน ณ วันที่", toThaiDate(order.salaryAsOfDate))}
          {field("ตำแหน่ง", order.positionName)}
          {field("ประเภทตำแหน่ง", order.positionType)}
          {field("ระดับ", order.positionLevel)}
          {field("สังกัด", order.bureau)}
          {field("กอง", order.division)}
          {field("กรม", order.department)}
          {field("กระทรวง", order.ministry)}
          {field("ชุดคำสั่ง", order.batch?.batchNo || null)}
        </div>
      </div>

      {/* Freshness Status */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold mb-4">🔍 สถานะความถูกต้อง</h2>
        <div className="flex flex-wrap gap-3">
          <FreshnessBadge status={order.statusSalary} label="เงินเดือน" />
          <FreshnessBadge status={order.statusPosition} label="ตำแหน่ง" />
          <FreshnessBadge status={order.statusType} label="ประเภท" />
          <FreshnessBadge status={order.statusLevel} label="ระดับ" />
          <FreshnessBadge status={order.statusOrg} label="สังกัด" />
        </div>
      </div>

      {/* Correction Chain */}
      {(correctedFromOrder || correctedOrders.length > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold mb-4">🔗 สายการแก้ไข</h2>
          <div className="space-y-2 text-sm">
            {correctedFromOrder && (
              <p>
                แก้ไขจาก:{" "}
                <Link href={`/orders/${correctedFromOrder.id}`} className="text-blue-600 hover:underline">
                  #{correctedFromOrder.id} {correctedFromOrder.orderNo || ""} ({typeLabel[correctedFromOrder.orderType] || correctedFromOrder.orderType})
                </Link>
              </p>
            )}
            {correctedOrders.length > 0 && (
              <p>
                แก้ไขไปยัง:{" "}
                {correctedOrders.map((o, i) => (
                  <span key={o.id}>
                    {i > 0 && ", "}
                    <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">
                      #{o.id} {o.orderNo || ""} ({typeLabel[o.orderType] || o.orderType})
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {canEdit && (
          <Link
            href={`/orders/${order.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            ✏️ แก้ไข
          </Link>
        )}
        <Link
          href="/orders"
          className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50"
        >
          ↩️ กลับ
        </Link>
      </div>
    </div>
  )
}
