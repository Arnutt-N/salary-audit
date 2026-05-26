import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const expired = await prisma.order.updateMany({
      where: {
        orderStatus: "preview",
        previewExpiresAt: { lt: new Date() },
      },
      data: { orderStatus: "cancelled" },
    })

    return NextResponse.json({
      cleaned: expired.count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Cleanup failed", detail: String(error) },
      { status: 500 }
    )
  }
}
