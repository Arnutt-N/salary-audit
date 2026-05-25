import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const [batches, total] = await Promise.all([
    prisma.orderBatch.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.orderBatch.count({ where }),
  ])

  return NextResponse.json({ batches, total, page, limit })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Guard: duplicate batchNo
    const existing = await prisma.orderBatch.findUnique({
      where: { batchNo: body.batchNo },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Batch number '${body.batchNo}' already exists` },
        { status: 409 }
      )
    }

    const batch = await prisma.orderBatch.create({
      data: {
        batchNo: body.batchNo,
        batchType: body.batchType,
        description: body.description ?? null,
        effectiveDate: body.effectiveDate ?? null,
        issueDate: body.issueDate ?? null,
        status: "draft",
      },
    })
    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create batch", detail: String(error) },
      { status: 500 }
    )
  }
}
