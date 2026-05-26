"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { orderSchema, type OrderFormData } from "@/lib/validation/order-schema"

const typeOptions = [
  { value: "salary_increase", label: "💰 เลื่อนเงินเดือน" },
  { value: "special_salary", label: "💰 เลื่อนพิเศษ" },
  { value: "promotion", label: "📈 เลื่อนตำแหน่ง" },
  { value: "transfer", label: "🔄 ย้าย" },
  { value: "transfer_in", label: "📥 รับโอน" },
  { value: "transfer_out", label: "📤 โอนออก" },
  { value: "resign", label: "👋 ลาออก" },
  { value: "retire", label: "🏁 เกษียณ" },
  { value: "education_adjust", label: "🎓 ปรับวุฒิ" },
  { value: "other", label: "📝 อื่นๆ" },
]

interface OrderData {
  id: number
  orderType: string
  orderNo: string | null
  issueDate: string
  effectiveDate: string
  salary: number | null
  salaryAsOfDate: string | null
  positionName: string | null
  positionType: string | null
  positionLevel: string | null
  bureau: string | null
  division: string | null
  department: string | null
  ministry: string | null
  person: {
    firstName: string | null
    lastName: string | null
  }
}

export function EditOrderForm({ order, canEdit }: { order: OrderData; canEdit: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      employeeId: 0, // not used for edit
      orderType: order.orderType,
      orderNo: order.orderNo || "",
      issueDate: order.issueDate,
      effectiveDate: order.effectiveDate,
      salary: order.salary,
      salaryAsOfDate: order.salaryAsOfDate || "",
      positionName: order.positionName || "",
      positionType: order.positionType || "",
      positionLevel: order.positionLevel || "",
      bureau: order.bureau || "",
      division: order.division || "",
      department: order.department || "",
      ministry: order.ministry || "",
    },
  })

  const onSubmit = async (data: OrderFormData) => {
    if (!canEdit) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: data.orderType,
          orderNo: data.orderNo || null,
          issueDate: data.issueDate,
          effectiveDate: data.effectiveDate,
          salary: data.salary ?? null,
          salaryAsOfDate: data.salaryAsOfDate || null,
          positionName: data.positionName || null,
          positionType: data.positionType || null,
          positionLevel: data.positionLevel || null,
          bureau: data.bureau || null,
          division: data.division || null,
          department: data.department || null,
          ministry: data.ministry || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "บันทึกไม่สำเร็จ")
        return
      }
      toast.success("แก้ไขคำสั่งสำเร็จ")
      router.push(`/orders/${order.id}`)
    } catch {
      toast.error("บันทึกไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <p className="text-sm text-zinc-500 mb-4">
          ข้าราชการ: <span className="font-medium text-zinc-700">{order.person.firstName} {order.person.lastName}</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">ประเภทคำสั่ง</label>
            <select {...register("orderType")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100">
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.orderType && <p className="text-xs text-red-500 mt-1">{errors.orderType.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เลขที่คำสั่ง</label>
            <input {...register("orderNo")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.orderNo && <p className="text-xs text-red-500 mt-1">{errors.orderNo.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่ลงคำสั่ง</label>
            <input type="date" {...register("issueDate")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.issueDate && <p className="text-xs text-red-500 mt-1">{errors.issueDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล</label>
            <input type="date" {...register("effectiveDate")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.effectiveDate && <p className="text-xs text-red-500 mt-1">{errors.effectiveDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน</label>
            <input type="number" {...register("salary", { valueAsNumber: true })} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.salary && <p className="text-xs text-red-500 mt-1">{errors.salary.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน ณ วันที่</label>
            <input type="date" {...register("salaryAsOfDate")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.salaryAsOfDate && <p className="text-xs text-red-500 mt-1">{errors.salaryAsOfDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ตำแหน่ง</label>
            <input {...register("positionName")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.positionName && <p className="text-xs text-red-500 mt-1">{errors.positionName.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภทตำแหน่ง</label>
            <input {...register("positionType")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.positionType && <p className="text-xs text-red-500 mt-1">{errors.positionType.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ระดับ</label>
            <input {...register("positionLevel")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.positionLevel && <p className="text-xs text-red-500 mt-1">{errors.positionLevel.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">สังกัด</label>
            <input {...register("bureau")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.bureau && <p className="text-xs text-red-500 mt-1">{errors.bureau.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">กอง</label>
            <input {...register("division")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.division && <p className="text-xs text-red-500 mt-1">{errors.division.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">กรม</label>
            <input {...register("department")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">กระทรวง</label>
            <input {...register("ministry")} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
            {errors.ministry && <p className="text-xs text-red-500 mt-1">{errors.ministry.message}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading || !canEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          💾 บันทึก
        </button>
        <button type="button" onClick={() => router.push(`/orders/${order.id}`)} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
          ↩️ ยกเลิก
        </button>
      </div>
    </form>
  )
}
