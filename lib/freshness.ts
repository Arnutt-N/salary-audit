import { prisma } from "./prisma"
import { parseISO, isValid } from "date-fns"

// ─── Types ───

export interface FreshnessResult {
  statusSalary: "latest" | "stale" | "corrected"
  statusPosition: "latest" | "stale" | "corrected"
  statusType: "latest" | "stale" | "corrected"
  statusLevel: "latest" | "stale" | "corrected"
  statusOrg: "latest" | "stale" | "corrected"
  overallStatus: "latest" | "stale"
}

export interface CurrentOrg {
  bureau: string | null
  division: string | null
  department: string | null
  ministry: string | null
}

export interface AffectedOrder {
  id: number
  orderType: string
  effectiveDate: string
  reason: string
  cascadeDepth: number
  actionRequired: "revise" | "cancel" | "review"
}

export interface PreviewResult {
  newOrderFreshness: FreshnessResult
  affectedOrders: AffectedOrder[]
  totalAffected: number
  byAction: { revise: number; cancel: number }
  maxCascadeDepth: number
  warnings: string[]
}

// ─── Helpers ───

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function toDateStr(d: Date | null): string | null {
  if (!d) return null
  return d.toISOString().split("T")[0] // "YYYY-MM-DD"
}

function parseJson(s: string | null | undefined): Record<string, unknown> | null {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// ─── 1. Max Salary Effective Date (§6) ───

export async function getMaxSalaryEffectiveDate(
  employeeId: number
): Promise<Date | null> {
  const results: (Date | null)[] = []

  // (a) salary_increase + special_salary orders
  const salaryOrders = await prisma.order.findMany({
    where: {
      employeeId,
      orderType: { in: ["salary_increase", "special_salary"] },
      orderStatus: "active",
    },
    select: { effectiveDate: true },
  })
  results.push(...salaryOrders.map((o) => parseDate(o.effectiveDate)))

  // (b) promotion orders (change calculation base)
  const promotions = await prisma.order.findMany({
    where: {
      employeeId,
      orderType: "promotion",
      orderStatus: "active",
    },
    select: { effectiveDate: true },
  })
  results.push(...promotions.map((o) => parseDate(o.effectiveDate)))

  // (c) system-wide adjustments
  const adjustments = await prisma.salaryAdjustmentApplicant.findMany({
    where: { employeeId, adjustment: { isActive: true } },
    select: { adjustment: { select: { adjustDate: true } } },
  })
  results.push(
    ...adjustments.map((a) => parseDate(a.adjustment.adjustDate))
  )

  // (d) education adjustments
  const edu = await prisma.employeeEducationAdjustment.findMany({
    where: { employeeId },
    select: { councilApprovalDate: true },
  })
  results.push(...edu.map((e) => parseDate(e.councilApprovalDate)))

  // (e) S5 compensation-to-salary
  const comps = await prisma.compensationToSalary.findMany({
    where: { employeeId },
    select: { effectiveDate: true },
  })
  results.push(...comps.map((c) => parseDate(c.effectiveDate)))

  const valid = results.filter((d): d is Date => d !== null)
  if (valid.length === 0) return null
  return new Date(Math.max(...valid.map((d) => d.getTime())))
}

// ─── 2. Current State Helpers ───

async function getLatestChangeLog(
  employeeId: number,
  changeType: string,
  excludeOrderId?: number
): Promise<Record<string, unknown> | null> {
  const log = await prisma.employeeChangeLog.findFirst({
    where: {
      employeeId,
      changeType,
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
    },
    orderBy: { effectiveDate: "desc" },
    select: { newValue: true },
  })
  if (!log?.newValue) return null
  return parseJson(log.newValue)
}

export async function getCurrentLevel(
  employeeId: number,
  excludeOrderId?: number
): Promise<string | null> {
  const data = await getLatestChangeLog(employeeId, "level", excludeOrderId)
  return (data?.position_level as string) ?? null
}

export async function getCurrentPosition(
  employeeId: number,
  excludeOrderId?: number
): Promise<string | null> {
  const data = await getLatestChangeLog(employeeId, "position", excludeOrderId)
  return (data?.position_name as string) ?? null
}

export async function getCurrentPositionType(
  employeeId: number,
  excludeOrderId?: number
): Promise<string | null> {
  const data = await getLatestChangeLog(employeeId, "position", excludeOrderId)
  return (data?.position_type as string) ?? null
}

export async function getCurrentOrg(
  employeeId: number,
  excludeOrderId?: number
): Promise<CurrentOrg> {
  const data = await getLatestChangeLog(employeeId, "org", excludeOrderId)
  return {
    bureau: (data?.bureau as string) ?? null,
    division: (data?.division as string) ?? null,
    department: (data?.department as string) ?? null,
    ministry: (data?.ministry as string) ?? null,
  }
}

// ─── 3. Applicable System Adjustments ───

export async function getApplicableAdjustments(employeeId: number) {
  return prisma.salaryAdjustmentApplicant.findMany({
    where: { employeeId, adjustment: { isActive: true } },
    include: { adjustment: true },
  })
}

// ─── 4. isOrderStale (§5) ───

export async function isOrderStale(order: {
  id: number
  employeeId: number
  salaryAsOfDate: string | null
  positionLevel: string | null
  positionName: string | null
  positionType: string | null
  bureau: string | null
  division: string | null
  department: string | null
  ministry: string | null
}): Promise<FreshnessResult> {
  const result: FreshnessResult = {
    statusSalary: "latest",
    statusPosition: "latest",
    statusType: "latest",
    statusLevel: "latest",
    statusOrg: "latest",
    overallStatus: "latest",
  }

  // Check 1: salary
  if (order.salaryAsOfDate) {
    const maxDate = await getMaxSalaryEffectiveDate(order.employeeId)
    const asOf = parseDate(order.salaryAsOfDate)
    if (maxDate && asOf && asOf < maxDate) {
      result.statusSalary = "stale"
    }
  }

  // Check 2: level
  if (order.positionLevel) {
    const current = await getCurrentLevel(order.employeeId, order.id)
    if (current && order.positionLevel !== current) {
      result.statusLevel = "stale"
    }
  }

  // Check 3: position name
  if (order.positionName) {
    const current = await getCurrentPosition(order.employeeId, order.id)
    if (current && order.positionName !== current) {
      result.statusPosition = "stale"
    }
  }

  // Check 4: position type
  if (order.positionType) {
    const current = await getCurrentPositionType(order.employeeId, order.id)
    if (current && order.positionType !== current) {
      result.statusType = "stale"
    }
  }

  // Check 5: org
  if (order.bureau || order.division || order.department || order.ministry) {
    const current = await getCurrentOrg(order.employeeId, order.id)
    if (
      (order.bureau && order.bureau !== current.bureau) ||
      (order.division && order.division !== current.division) ||
      (order.department && order.department !== current.department) ||
      (order.ministry && order.ministry !== current.ministry)
    ) {
      result.statusOrg = "stale"
    }
  }

  // Check 6: system adjustments
  if (order.salaryAsOfDate) {
    const adjs = await getApplicableAdjustments(order.employeeId)
    const asOf = parseDate(order.salaryAsOfDate)
    for (const adj of adjs) {
      const adjDate = parseDate(adj.adjustment.adjustDate)
      if (adjDate && asOf && asOf < adjDate) {
        result.statusSalary = "stale"
        break
      }
    }
  }

  result.overallStatus =
    result.statusSalary === "stale" ||
    result.statusLevel === "stale" ||
    result.statusPosition === "stale" ||
    result.statusType === "stale" ||
    result.statusOrg === "stale"
      ? "stale"
      : "latest"

  return result
}

// ─── 5. Validate & Update Order ───

export async function validateOrderFreshness(orderId: number): Promise<FreshnessResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      employeeId: true,
      salaryAsOfDate: true,
      positionLevel: true,
      positionName: true,
      positionType: true,
      bureau: true,
      division: true,
      department: true,
      ministry: true,
    },
  })
  if (!order) throw new Error(`Order #${orderId} not found`)

  const result = await isOrderStale(order)

  await prisma.order.update({
    where: { id: orderId },
    data: {
      statusSalary: result.statusSalary,
      statusPosition: result.statusPosition,
      statusType: result.statusType,
      statusLevel: result.statusLevel,
      statusOrg: result.statusOrg,
      updatedAt: new Date(),
    },
  })

  return result
}

// ─── 6. Dependency Check ───

export function hasDependency(
  existingOrder: {
    orderType: string
    effectiveDate: string
    salaryAsOfDate: string | null
  },
  newOrder: {
    id: number
    orderType: string
    effectiveDate: string
  }
): boolean {
  // newOrder changes salary → existing order references salary
  if (
    ["salary_increase", "special_salary"].includes(newOrder.orderType) &&
    existingOrder.salaryAsOfDate
  ) {
    return true
  }

  // newOrder is resign → salary_increase orders after resign date are affected
  if (
    newOrder.orderType === "resign" &&
    existingOrder.orderType === "salary_increase" &&
    newOrder.effectiveDate <= existingOrder.effectiveDate
  ) {
    return true
  }

  // newOrder changes level/position/org → salary_increase orders affected
  if (
    ["promotion", "transfer"].includes(newOrder.orderType) &&
    existingOrder.orderType === "salary_increase" &&
    newOrder.effectiveDate <= existingOrder.effectiveDate
  ) {
    return true
  }

  // S5 affects orders that reference salary
  if (
    ["salary_cap_adjustment"].includes(newOrder.orderType) &&
    existingOrder.salaryAsOfDate
  ) {
    return true
  }

  return false
}

// ─── 7. Build Preview Reason ───

export function buildPreviewReason(
  newOrder: { id: number; orderType: string; effectiveDate: string },
  existingOrder: { id: number; orderType: string; effectiveDate: string }
): string {
  const typeMap: Record<string, string> = {
    salary_increase: "เลื่อนเงินเดือน",
    special_salary: "เลื่อนเงินเดือนกรณีพิเศษ",
    promotion: "เลื่อนระดับ",
    transfer: "ย้าย",
    resign: "ลาออก",
    salary_cap_adjustment: "ค่าตอบแทนพิเศษ → เลื่อนเงินเดือน",
  }

  const newType = typeMap[newOrder.orderType] || newOrder.orderType
  const existingType = typeMap[existingOrder.orderType] || existingOrder.orderType

  return `คำสั่ง${newType} #${newOrder.id} (effective ${newOrder.effectiveDate}) กระทบข้อมูลในคำสั่ง${existingType} #${existingOrder.id}`
}

// ─── 8. Cascade Stale Check (§10.3) ───

async function findAffectedOrders(
  order: { id: number; employeeId: number; orderType: string; effectiveDate: string }
): Promise<{ id: number }[]> {
  return prisma.order.findMany({
    where: {
      employeeId: order.employeeId,
      id: { not: order.id },
      orderStatus: "active",
      effectiveDate: { gte: order.effectiveDate },
    },
    select: { id: true },
  })
}

export async function cascadeStaleCheck(
  orderId: number,
  visited: Set<number> = new Set(),
  depth = 0,
  maxDepth = 10
): Promise<number> {
  if (visited.has(orderId) || depth > maxDepth) return 0

  visited.add(orderId)

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      employeeId: true,
      orderType: true,
      effectiveDate: true,
    },
  })
  if (!order) return 0

  const affected = await findAffectedOrders(order)
  let count = 0

  for (const a of affected) {
    const aOrder = await prisma.order.findUnique({
      where: { id: a.id },
      select: {
        id: true,
        employeeId: true,
        salaryAsOfDate: true,
        orderType: true,
        effectiveDate: true,
      },
    })
    if (!aOrder) continue

    if (hasDependency(aOrder, order)) {
      await validateOrderFreshness(a.id)
      count++
      count += await cascadeStaleCheck(a.id, visited, depth + 1, maxDepth)
    }
  }

  return count
}

// ─── 9. Preview Impact (§9.7) ───

export async function previewImpact(
  newOrderData: {
    employeeId: number
    orderType: string
    effectiveDate: string
    salary?: number | null
    salaryAsOfDate?: string | null
    positionName?: string | null
    positionType?: string | null
    positionLevel?: string | null
    bureau?: string | null
    division?: string | null
    department?: string | null
    ministry?: string | null
  }
): Promise<PreviewResult> {
  const newOrderDraft = {
    id: -1, // preview
    employeeId: newOrderData.employeeId,
    orderType: newOrderData.orderType,
    effectiveDate: newOrderData.effectiveDate,
    salaryAsOfDate: newOrderData.salaryAsOfDate ?? null,
    positionLevel: newOrderData.positionLevel ?? null,
    positionName: newOrderData.positionName ?? null,
    positionType: newOrderData.positionType ?? null,
    bureau: newOrderData.bureau ?? null,
    division: newOrderData.division ?? null,
    department: newOrderData.department ?? null,
    ministry: newOrderData.ministry ?? null,
  }

  const freshness = await isOrderStale(newOrderDraft)

  // Find active orders for same employee with effectiveDate >= new
  const existingOrders = await prisma.order.findMany({
    where: {
      employeeId: newOrderData.employeeId,
      orderStatus: "active",
      effectiveDate: { gte: newOrderData.effectiveDate },
    },
    orderBy: { effectiveDate: "asc" },
  })

  const affectedOrders: AffectedOrder[] = []
  const visited = new Set<number>()

  for (const o of existingOrders) {
    if (visited.has(o.id)) continue
    visited.add(o.id)

    const dep = hasDependency(
      {
        orderType: o.orderType,
        effectiveDate: o.effectiveDate,
        salaryAsOfDate: o.salaryAsOfDate,
      },
      { id: -1, orderType: newOrderData.orderType, effectiveDate: newOrderData.effectiveDate }
    )

    if (dep) {
      const action: "revise" | "cancel" =
        newOrderData.orderType === "resign" && o.orderType === "salary_increase"
          ? "cancel"
          : "revise"

      affectedOrders.push({
        id: o.id,
        orderType: o.orderType,
        effectiveDate: o.effectiveDate,
        reason: buildPreviewReason(
          { id: -1, orderType: newOrderData.orderType, effectiveDate: newOrderData.effectiveDate },
          { id: o.id, orderType: o.orderType, effectiveDate: o.effectiveDate }
        ),
        cascadeDepth: 0,
        actionRequired: action,
      })
    }
  }

  const warnings: string[] = []
  if (affectedOrders.some((o) => o.actionRequired === "cancel")) {
    warnings.push("มีคำสั่งที่ต้องถูกเพิกถอน — ตรวจสอบผลกระทบด้านสิทธิประโยชน์")
  }
  if (affectedOrders.length > 10) {
    warnings.push(`พบ ${affectedOrders.length} คำสั่งที่ได้รับผลกระทบ — แนะนำตรวจสอบทีละรายการ`)
  }

  return {
    newOrderFreshness: freshness,
    affectedOrders,
    totalAffected: affectedOrders.length,
    byAction: {
      revise: affectedOrders.filter((o) => o.actionRequired === "revise").length,
      cancel: affectedOrders.filter((o) => o.actionRequired === "cancel").length,
    },
    maxCascadeDepth: 0, // preview shows direct impact only; cascade runs on activation
    warnings,
  }
}
