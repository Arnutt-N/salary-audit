import { NextResponse } from "next/server"
import { previewImpact } from "@/lib/freshness"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await previewImpact(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: "Preview failed", detail: String(error) },
      { status: 500 }
    )
  }
}
