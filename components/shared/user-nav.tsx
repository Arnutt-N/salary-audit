"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export function UserNav() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
  }

  if (!session) {
    return (
      <Link href="/login" className="text-zinc-400 hover:text-zinc-600 text-xs">
        เข้าสู่ระบบ
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500">{session.user?.name}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
      >
        ออกจากระบบ
      </button>
    </div>
  )
}
