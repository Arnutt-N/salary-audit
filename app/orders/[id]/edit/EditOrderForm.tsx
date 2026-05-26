"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
  const [form, setForm] = useState({
    orderType: order.orderType,
    orderNo: order.orderNo || "",
    issueDate: order.issueDate,
    effectiveDate: order.effectiveDate,
    salary: order.salary != null ? String(order.salary) : "",
    salaryAsOfDate: order.salaryAsOfDate || "",
    positionName: order.positionName || "",
    positionType: order.positionType || "",
    positionLevel: order.positionLevel || "",
    bureau: order.bureau || "",
    division: order.division || "",
    department: order.department || "",
    ministry: order.ministry || "",
  })

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!canEdit) return
    if (form.salaryAsOfDate && form.effectiveDate && form.salaryAsOfDate > form.effectiveDate) {
      toast.error("เงินเดือน ณ วันที่ ต้องไม่เกินวันที่มีผล")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: form.orderType,
          orderNo: form.orderNo || null,
          issueDate: form.issueDate,
          effectiveDate: form.effectiveDate,
          salary: form.salary ? parseFloat(form.salary) : null,
          salaryAsOfDate: form.salaryAsOfDate || null,
          positionName: form.positionName || null,
          positionType: form.positionType || null,
          positionLevel: form.positionLevel || null,
          bureau: form.bureau || null,
          division: form.division || null,
          department: form.department || null,
          ministry: form.ministry || null,
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
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <p className="text-sm text-zinc-500 mb-4">
          ข้าราชการ: <span className="font-medium text-zinc-700">{order.person.firstName} {order.person.lastName}</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">ประเภทคำสั่ง</label>
            <select value={form.orderType} onChange={(e) => set("orderType", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100">
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">เลขที่คำสั่ง</label>
            <input value={form.orderNo} onChange={(e) => set("orderNo", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่ลงคำสั่ง</label>
            <input type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน</label>
            <input type="number" value={form.salary} onChange={(e) => set("salary", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน ณ วันที่</label>
            <input type="date" value={form.salaryAsOfDate} onChange={(e) => set("salaryAsOfDate", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ตำแหน่ง</label>
            <input value={form.positionName} onChange={(e) => set("positionName", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภทตำแหน่ง</label>
            <input value={form.positionType} onChange={(e) => set("positionType", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ระดับ</label>
            <input value={form.positionLevel} onChange={(e) => set("positionLevel", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">สังกัด</label>
            <input value={form.bureau} onChange={(e) => set("bureau", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">กอง</label>
            <input value={form.division} onChange={(e) => set("division", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">กรม</label>
            <input value={form.department} onChange={(e) => set("department", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">กระทรวง</label>
            <input value={form.ministry} onChange={(e) => set("ministry", e.target.value)} disabled={!canEdit} className="w-full px-3 py-2 border rounded-lg text-sm mt-1 disabled:bg-zinc-100" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={loading || !canEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          💾 บันทึก
        </button>
        <button onClick={() => router.push(`/orders/${order.id}`)} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
          ↩️ ยกเลิก
        </button>
      </div>
    </div>
  )
}
