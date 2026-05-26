import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditOrderForm } from "./EditOrderForm"

export default async function EditOrderPage({
  params,
}: {
  params: { id: string }
}) {
  const id = params.id
  const order = await prisma.order.findUnique({
    where: { id: parseInt(id) },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentPositionName: true,
          currentPositionType: true,
          currentPositionLevel: true,
          currentBureau: true,
          currentDivision: true,
          currentDepartment: true,
          currentMinistry: true,
          currentSalary: true,
        },
      },
    },
  })

  if (!order) notFound()

  const canEdit = ["draft", "active"].includes(order.orderStatus)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">✏️ แก้ไขคำสั่ง #{order.id}</h1>
      {!canEdit && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          ⚠️ คำสั่งนี้มีสถานะ &quot;{order.orderStatus}&quot; — ไม่สามารถแก้ไขได้
        </div>
      )}
      <EditOrderForm order={order} canEdit={canEdit} />
    </div>
  )
}
