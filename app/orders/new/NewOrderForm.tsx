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

interface Person {
  id: number
  firstName: string | null
  lastName: string | null
  currentPositionName?: string | null
  currentPositionType?: string | null
  currentPositionLevel?: string | null
  currentBureau?: string | null
  currentDivision?: string | null
  currentDepartment?: string | null
  currentMinistry?: string | null
  currentSalary?: number | null
}

interface PreviewResult {
  totalAffected: number
  affectedOrders: Array<{
    id: number
    orderType: string
    effectiveDate: string
    reason: string
    actionRequired: string
  }>
  warnings: string[]
}

export function NewOrderForm() {
  const router = useRouter()
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      employeeId: undefined,
      orderType: "salary_increase",
      orderNo: "",
      issueDate: "",
      effectiveDate: "",
      salary: null,
      salaryAsOfDate: "",
      positionName: "",
      positionType: "",
      positionLevel: "",
      bureau: "",
      division: "",
      department: "",
      ministry: "",
    },
  })

  // Read current form values for preview/API calls
  const formValues = watch()

  // Employee search
  const handleSearch = async () => {
    if (!employeeSearch.trim()) return
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(employeeSearch)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.persons || [])
    } catch {
      toast.error("ค้นหาไม่สำเร็จ")
    }
  }

  const selectPerson = (p: Person) => {
    setSelectedPerson(p)
    setSearchResults([])
    setEmployeeSearch(`${p.firstName} ${p.lastName}`)
    // Set employeeId
    setValue("employeeId", p.id, { shouldValidate: true })
    // Auto-fill current state
    setValue("positionName", p.currentPositionName || "")
    setValue("positionType", p.currentPositionType || "")
    setValue("positionLevel", p.currentPositionLevel || "")
    setValue("bureau", p.currentBureau || "")
    setValue("division", p.currentDivision || "")
    setValue("department", p.currentDepartment || "")
    setValue("ministry", p.currentMinistry || "")
    if (p.currentSalary) setValue("salary", p.currentSalary)
  }

  // Preview
  const handlePreview = async () => {
    if (!selectedPerson) { toast.error("กรุณาเลือกข้าราชการ"); return }
    if (!formValues.effectiveDate) { toast.error("กรุณากรอกวันที่มีผล"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedPerson.id,
          orderType: formValues.orderType,
          effectiveDate: formValues.effectiveDate,
          salary: formValues.salary ? Number(formValues.salary) : undefined,
          salaryAsOfDate: formValues.salaryAsOfDate || undefined,
          positionLevel: formValues.positionLevel || undefined,
        }),
      })
      const data = await res.json()
      setPreview(data)
    } catch {
      toast.error("Preview ไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  // Submit helpers — react-hook-form handleSubmit validates before calling
  const submitOrder = async (data: OrderFormData, orderStatus: "draft" | "active") => {
    if (!selectedPerson) { toast.error("กรุณาเลือกข้าราชการ"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedPerson.id,
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
          orderStatus,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "บันทึกไม่สำเร็จ")
        return
      }
      toast.success(orderStatus === "draft" ? "บันทึกแบบร่างสำเร็จ" : "บันทึกและเปิดใช้สำเร็จ")
      router.push("/orders")
    } catch {
      toast.error("บันทึกไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  const onDraft = handleSubmit((data) => submitOrder(data, "draft"))
  const onActive = handleSubmit((data) => submitOrder(data, "active"))

  return (
    <div className="space-y-6">
      {/* Employee Select */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold mb-4">👤 เลือกข้าราชการ</h2>
        <div className="flex gap-2">
          <input
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            placeholder="ค้นหาชื่อ..."
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            ค้นหา
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPerson(p)}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm"
              >
                {p.firstName} {p.lastName} — {p.currentPositionName || "—"}
              </button>
            ))}
          </div>
        )}
        {selectedPerson && (
          <p className="mt-2 text-sm text-green-600">✅ เลือก: {selectedPerson.firstName} {selectedPerson.lastName}</p>
        )}
        {errors.employeeId && <p className="text-xs text-red-500 mt-1">{errors.employeeId.message}</p>}
      </div>

      {/* Order Fields */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold mb-4">📝 ข้อมูลคำสั่ง</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">ประเภทคำสั่ง</label>
            <select {...register("orderType")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.orderType && <p className="text-xs text-red-500 mt-1">{errors.orderType.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เลขที่คำสั่ง</label>
            <input {...register("orderNo")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.orderNo && <p className="text-xs text-red-500 mt-1">{errors.orderNo.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่ลงคำสั่ง</label>
            <input type="date" {...register("issueDate")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.issueDate && <p className="text-xs text-red-500 mt-1">{errors.issueDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล *</label>
            <input type="date" {...register("effectiveDate")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.effectiveDate && <p className="text-xs text-red-500 mt-1">{errors.effectiveDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน</label>
            <input type="number" {...register("salary", { valueAsNumber: true })} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.salary && <p className="text-xs text-red-500 mt-1">{errors.salary.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน ณ วันที่</label>
            <input type="date" {...register("salaryAsOfDate")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.salaryAsOfDate && <p className="text-xs text-red-500 mt-1">{errors.salaryAsOfDate.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ตำแหน่ง</label>
            <input {...register("positionName")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.positionName && <p className="text-xs text-red-500 mt-1">{errors.positionName.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภทตำแหน่ง</label>
            <input {...register("positionType")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.positionType && <p className="text-xs text-red-500 mt-1">{errors.positionType.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">ระดับ</label>
            <input {...register("positionLevel")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.positionLevel && <p className="text-xs text-red-500 mt-1">{errors.positionLevel.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">สังกัด</label>
            <input {...register("bureau")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.bureau && <p className="text-xs text-red-500 mt-1">{errors.bureau.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">กอง</label>
            <input {...register("division")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.division && <p className="text-xs text-red-500 mt-1">{errors.division.message}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">กรม</label>
            <input {...register("department")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">กระทรวง</label>
            <input {...register("ministry")} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            {errors.ministry && <p className="text-xs text-red-500 mt-1">{errors.ministry.message}</p>}
          </div>
        </div>
      </div>

      {/* Preview Result */}
      {preview && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold mb-4">👁️ ผล Preview</h2>
          <p className="text-sm mb-2">กระทบ {preview.totalAffected} คำสั่ง</p>
          {preview.affectedOrders?.map((o) => (
            <div key={o.id} className="text-sm py-1 border-b last:border-0">
              <span className="font-mono">#{o.id}</span> — {o.reason} ({o.actionRequired})
            </div>
          ))}
          {preview.warnings?.map((w, i) => (
            <p key={i} className="text-sm text-amber-600 mt-2">⚠️ {w}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handlePreview} disabled={loading} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50 disabled:opacity-50">
          🔍 Preview Impact
        </button>
        <button onClick={onDraft} disabled={loading} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50 disabled:opacity-50">
          💾 บันทึกแบบร่าง
        </button>
        <button onClick={onActive} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          ✅ บันทึกและเปิดใช้
        </button>
      </div>
    </div>
  )
}
