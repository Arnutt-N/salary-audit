"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const batchTypeOptions = [
  { value: "salary_apr", label: "💰 เลื่อนเงินเดือน 1 เม.ย." },
  { value: "salary_oct", label: "💰 เลื่อนเงินเดือน 1 ต.ค." },
  { value: "promotion", label: "📈 เลื่อนตำแหน่ง" },
  { value: "transfer", label: "🔄 ย้าย" },
]

export function NewBatchForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    batchNo: "",
    batchType: "salary_apr",
    effectiveDate: "",
    description: "",
  })

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.batchNo.trim()) { toast.error("กรุณากรอกเลขที่ชุด"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNo: form.batchNo,
          batchType: form.batchType,
          effectiveDate: form.effectiveDate || null,
          description: form.description || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 409) {
          toast.error("เลขนี้มีอยู่แล้ว")
        } else {
          toast.error(err.error || "สร้างไม่สำเร็จ")
        }
        return
      }
      const batch = await res.json()
      toast.success("สร้างชุดคำสั่งสำเร็จ")
      router.push(`/batches/${batch.id}`)
    } catch {
      toast.error("สร้างไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">เลขที่ชุด *</label>
            <input value={form.batchNo} onChange={(e) => set("batchNo", e.target.value)} placeholder="เช่น SAL-APR-2569-001" className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภท</label>
            <select value={form.batchType} onChange={(e) => set("batchType", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
              {batchTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">คำอธิบาย</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          📦 สร้างชุดคำสั่ง
        </button>
        <button onClick={() => router.push("/batches")} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50">
          ↩️ ยกเลิก
        </button>
      </div>
    </div>
  )
}
