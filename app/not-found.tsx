import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-4xl font-bold text-zinc-300">404</h1>
      <p className="text-zinc-500">ไม่พบหน้าที่คุณต้องการ</p>
      <Link href="/" className="text-blue-600 hover:underline">
        กลับหน้าหลัก
      </Link>
    </div>
  )
}
