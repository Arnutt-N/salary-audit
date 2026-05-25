import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function Home() {
  const [
    totalOrders,
    totalActive,
    staleCount,
    totalBatches,
    pendingBatches,
    totalPersons,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "active" } }),
    prisma.order.count({
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
    }),
    prisma.orderBatch.count(),
    prisma.orderBatch.count({
      where: { status: { in: ["draft", "previewing", "previewed"] } },
    }),
    prisma.person.count({ where: { isActive: true } }),
  ])

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ระบบตรวจสอบคำสั่ง HR</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card label="คำสั่งทั้งหมด" value={totalOrders} href="/orders" />
        <Card
          label="คำสั่งที่ active"
          value={totalActive}
          href="/orders?status=active"
        />
        <Card
          label="ต้องแก้ไข"
          value={staleCount}
          href="/dashboard/stale"
          alert={staleCount > 0}
        />
        <Card label="ชุดคำสั่ง" value={totalBatches} href="/batches" />
        <Card label="รอดำเนินการ" value={pendingBatches} href="/batches" />
        <Card label="ข้าราชการ" value={totalPersons} href="/persons" />
      </div>

      <div className="flex gap-4">
        <Link
          href="/batches"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          📦 จัดการชุดคำสั่ง
        </Link>
        <Link
          href="/dashboard/stale"
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium"
        >
          🚨 ดูคำสั่งที่ต้องแก้ไข
        </Link>
        <Link
          href="/orders"
          className="bg-zinc-600 text-white px-6 py-3 rounded-lg hover:bg-zinc-700 font-medium"
        >
          📋 คำสั่งทั้งหมด
        </Link>
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  href,
  alert,
}: {
  label: string
  value: number
  href: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl p-4 shadow-sm border transition-colors hover:shadow-md ${
        alert ? "bg-red-50 border-red-200" : "bg-white"
      }`}
    >
      <div
        className={`text-3xl font-bold ${alert ? "text-red-700" : "text-zinc-900"}`}
      >
        {value}
      </div>
      <div className="text-sm text-zinc-500 mt-1">{label}</div>
    </Link>
  )
}
