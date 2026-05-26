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

  // Form state
  const [form, setForm] = useState({
    orderType: "salary_increase",
    orderNo: "",
    issueDate: "",
    effectiveDate: "",
    salary: "",
    salaryAsOfDate: "",
    positionName: "",
    positionType: "",
    positionLevel: "",
    bureau: "",
    division: "",
    department: "",
    ministry: "",
  })

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

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
    // Auto-fill current state
    set("positionName", p.currentPositionName || "")
    set("positionType", p.currentPositionType || "")
    set("positionLevel", p.currentPositionLevel || "")
    set("bureau", p.currentBureau || "")
    set("division", p.currentDivision || "")
    set("department", p.currentDepartment || "")
    set("ministry", p.currentMinistry || "")
    if (p.currentSalary) set("salary", String(p.currentSalary))
  }

  // Preview
  const handlePreview = async () => {
    if (!selectedPerson) { toast.error("กรุณาเลือกข้าราชการ"); return }
    if (!form.effectiveDate) { toast.error("กรุณากรอกวันที่มีผล"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedPerson.id,
          orderType: form.orderType,
          effectiveDate: form.effectiveDate,
          salary: form.salary ? parseFloat(form.salary) : undefined,
          salaryAsOfDate: form.salaryAsOfDate || undefined,
          positionLevel: form.positionLevel || undefined,
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

  // Submit
  const handleSubmit = async (orderStatus: "draft" | "active") => {
    if (!selectedPerson) { toast.error("กรุณาเลือกข้าราชการ"); return }
    if (!form.effectiveDate) { toast.error("กรุณากรอกวันที่มีผล"); return }
    if (form.salaryAsOfDate && form.effectiveDate && form.salaryAsOfDate > form.effectiveDate) {
      toast.error("เงินเดือน ณ วันที่ ต้องไม่เกินวันที่มีผล")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedPerson.id,
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
      </div>

      {/* Order Fields */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold mb-4">📝 ข้อมูลคำสั่ง</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500">ประเภทคำสั่ง</label>
            <select value={form.orderType} onChange={(e) => set("orderType", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1">
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">เลขที่คำสั่ง</label>
            <input value={form.orderNo} onChange={(e) => set("orderNo", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่ลงคำสั่ง</label>
            <input type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">วันที่มีผล *</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน</label>
            <input type="number" value={form.salary} onChange={(e) => set("salary", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">เงินเดือน ณ วันที่</label>
            <input type="date" value={form.salaryAsOfDate} onChange={(e) => set("salaryAsOfDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ตำแหน่ง</label>
            <input value={form.positionName} onChange={(e) => set("positionName", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ประเภทตำแหน่ง</label>
            <input value={form.positionType} onChange={(e) => set("positionType", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">ระดับ</label>
            <input value={form.positionLevel} onChange={(e) => set("positionLevel", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">สังกัด</label>
            <input value={form.bureau} onChange={(e) => set("bureau", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">กอง</label>
            <input value={form.division} onChange={(e) => set("division", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">กรม</label>
            <input value={form.department} onChange={(e) => set("department", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500">กระทรวง</label>
            <input value={form.ministry} onChange={(e) => set("ministry", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
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
        <button onClick={() => handleSubmit("draft")} disabled={loading} className="px-4 py-2 border rounded-lg text-sm hover:bg-zinc-50 disabled:opacity-50">
          💾 บันทึกแบบร่าง
        </button>
        <button onClick={() => handleSubmit("active")} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          ✅ บันทึกและเปิดใช้
        </button>
      </div>
    </div>
  )
}
