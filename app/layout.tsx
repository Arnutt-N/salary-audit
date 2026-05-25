import type { Metadata } from "next"
import Link from "next/link"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Salary Audit — ระบบตรวจสอบคำสั่งข้าราชการ",
  description: "HR Order Freshness Check System",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <nav className="border-b bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto flex items-center gap-6 px-6 h-12 text-sm">
            <Link href="/" className="font-bold text-zinc-900">Salary Audit</Link>
            <Link href="/orders" className="text-zinc-600 hover:text-zinc-900">คำสั่ง</Link>
            <Link href="/batches" className="text-zinc-600 hover:text-zinc-900">ชุดคำสั่ง</Link>
            <Link href="/dashboard/stale" className="text-red-600 hover:text-red-800">ต้องแก้ไข</Link>
            <div className="flex-1" />
            <Link href="/login" className="text-zinc-400 hover:text-zinc-600 text-xs">เข้าสู่ระบบ</Link>
          </div>
        </nav>
        {children}
        <Toaster position="top-right" richColors duration={4000} />
      </body>
    </html>
  )
}
