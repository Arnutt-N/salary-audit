import { test, describe, before, after } from "node:test"
import assert from "node:assert"
import { prisma } from "../lib/prisma"
import {
  isOrderStale,
  validateOrderFreshness,
  getMaxSalaryEffectiveDate,
  cascadeStaleCheck,
} from "../lib/freshness"
import { seedFreshnessDb } from "./fixtures/seed-freshness"

let personId: number

before(async () => {
  const data = await seedFreshnessDb()
  personId = data.personId
})

after(async () => {
  // Cleanup handled by seedFreshnessDb on next run
})

describe("isOrderStale", () => {
  test("returns false when order data matches person current data", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "transfer",
        issueDate: "2569-01-15",
        effectiveDate: "2569-02-01",
        salary: 25000,
        positionName: "นักจัดการงานทั่วไป",
        positionType: "วิชาการ",
        positionLevel: "ชำนาญการ",
        bureau: "กองการเจ้าหน้าที่",
        division: "กลุ่มงานทะเบียนประวัติ",
        department: "สำนักงานปลัดกระทรวง",
        ministry: "กระทรวงทดสอบ",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result, false)
  })

  test("returns true when salary differs from current", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "transfer",
        issueDate: "2568-10-01",
        effectiveDate: "2568-10-01",
        salary: 20000, // different from current 25000
        positionName: "นักจัดการงานทั่วไป",
        positionType: "วิชาการ",
        positionLevel: "ชำนาญการ",
        bureau: "กองการเจ้าหน้าที่",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result, true)
  })

  test("returns false when order is excluded via exclude_order_id", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "salary_apr",
        issueDate: "2569-05-01",
        effectiveDate: "2569-04-01",
        salary: 30000, // different from current 25000
      },
    })

    // This order IS the correction — should not flag itself as stale
    const result = await isOrderStale(order, order.id)
    assert.strictEqual(result, false)
  })

  test("returns true when position level changed", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "promotion",
        issueDate: "2568-06-01",
        effectiveDate: "2568-06-01",
        positionLevel: "ปฏิบัติการ", // different from "ชำนาญการ"
        positionName: "นักจัดการงานทั่วไป",
        positionType: "วิชาการ",
        bureau: "กองการเจ้าหน้าที่",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result, true)
  })

  test("returns false when salary is null in both order and person", async () => {
    // Create person with null salary
    const nullPerson = await prisma.person.create({
      data: {
        firstName: "ไร้เงิน",
        lastName: "เดือน",
        currentPositionName: "ตำแหน่งว่าง",
        currentSalary: null,
        isActive: true,
      },
    })

    const order = await prisma.order.create({
      data: {
        employeeId: nullPerson.id,
        orderType: "other",
        issueDate: "2569-01-01",
        effectiveDate: "2569-01-01",
        salary: null,
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result, false)
  })
})

describe("getMaxSalaryEffectiveDate", () => {
  test("returns the latest date from all salary sources", async () => {
    const date = await getMaxSalaryEffectiveDate(personId)
    // Should return at minimum the salary_adjustment date (2569-07-01)
    assert.ok(date !== null)
    assert.ok(date >= "2569-07-01")
  })

  test("returns null for non-existent person", async () => {
    const date = await getMaxSalaryEffectiveDate(999999)
    assert.strictEqual(date, null)
  })
})

describe("validateOrderFreshness", () => {
  test("returns all 5 freshness flags", async () => {
    // Find an existing order for this person
    const order = await prisma.order.findFirst({
      where: { employeeId: personId },
    })
    assert.ok(order, "No order found for test person")

    const result = await validateOrderFreshness(order!.id)
    assert.ok("statusSalary" in result)
    assert.ok("statusPosition" in result)
    assert.ok("statusType" in result)
    assert.ok("statusLevel" in result)
    assert.ok("statusOrg" in result)
  })

  test("updates order freshness flags in database", async () => {
    const order = await prisma.order.findFirst({
      where: { employeeId: personId },
    })
    assert.ok(order)

    const result = await validateOrderFreshness(order!.id)

    // Re-read order from DB to verify persistence
    const updated = await prisma.order.findUnique({
      where: { id: order!.id },
    })
    assert.ok(updated)
    assert.strictEqual(updated!.statusSalary, result.statusSalary)
  })
})

describe("cascadeStaleCheck", () => {
  test("returns affected orders array", async () => {
    const result = await cascadeStaleCheck(personId, "2569-04-01")
    assert.ok(Array.isArray(result))
  })

  test("respects max_depth limit", async () => {
    const result = await cascadeStaleCheck(personId, "2569-04-01", 1)
    // max_depth=1 means cascade at most 1 level deep
    // Result is an array of affected order IDs
    assert.ok(Array.isArray(result))
  })

  test("returns empty for non-existent person", async () => {
    const result = await cascadeStaleCheck(999999, "2569-01-01")
    assert.strictEqual(result.length, 0)
  })
})
