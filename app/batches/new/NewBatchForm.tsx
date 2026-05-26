"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { batchSchema, type BatchFormData } from "@/lib/validation/batch-schema"

const batchTypeOptions = [
  { value: "salary_apr", label: "💰 เลื่อนเงินเดือน 1 เม.ย." },
  { value: "salary_oct", label: "💰 เลื่อนเงินเดือน 1 ต.ค." },
  { value: "promotion", label: "📈 เลื่อนตำแหน่ง" },
  { value: "transfer", label: "🔄 ย้าย" },
]

export function NewBatchForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batchNo: "",
      batchType: "salary_apr",
      effectiveDate: "",
      description: "",
    },
  })

  const onSubmit = async (data: BatchFormData) => {
    setLoading(true)
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNo: data.batchNo,
          batchType: data.batchType,
          effectiveDate: data.effectiveDate || null,
          description: data.description || null,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">เลขที่ชุด *</label>
            <input
              {...register("batchNo")}
              placeholder="เช่น SAL-APR-2569-001"
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            />
            {errors.batchNo && (
              <p className="text-xs text-red-500 mt-1">{errors.batchNo.message}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภท</label>
            <select
              {...register("batchType")}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            >
              {batchTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.batchType && (
              <p className="text-xs text-red-500 mt-1">{errors.batchType.message}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล</label>
            <input
              type="date"
              {...register("effectiveDate")}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            />
            {errors.effectiveDate && (
              <p className="text-xs text-red-500 mt-1">{errors.effectiveDate.message}</p>
            )}
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">คำอธิบาย</label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          📦 สร้างชุดคำสั่ง
        </button>
        <button
          type="button"
          onClick={() => router.push("/batches")}
          className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50"
        >
          ↩️ ยกเลิก
        </button>
      </div>
    </form>
  )
}
