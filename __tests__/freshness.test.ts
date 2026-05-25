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
  test("returns latest when salaryAsOfDate matches person current data", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "transfer",
        issueDate: "2569-01-15",
        effectiveDate: "2569-02-01",
        salaryAsOfDate: "2569-02-01",
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
    assert.strictEqual(result.overallStatus, "latest")
  })

  test("returns stale when salaryAsOfDate is before latest adjustment", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "transfer",
        issueDate: "2568-10-01",
        effectiveDate: "2568-10-01",
        salaryAsOfDate: "2568-10-01", // before 2569-07-01 adjustment
        positionName: "นักจัดการงานทั่วไป",
        positionType: "วิชาการ",
        positionLevel: "ชำนาญการ",
        bureau: "กองการเจ้าหน้าที่",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result.overallStatus, "stale")
  })

  test("returns stale when position level differs from current", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "promotion",
        issueDate: "2568-06-01",
        effectiveDate: "2568-06-01",
        salaryAsOfDate: "2568-06-01",
        positionLevel: "ปฏิบัติการ", // different from "ชำนาญการ"
        positionName: "นักจัดการงานทั่วไป",
        positionType: "วิชาการ",
        bureau: "กองการเจ้าหน้าที่",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result.overallStatus, "stale")
    assert.strictEqual(result.statusLevel, "stale")
  })

  test("returns latest when order salaryAsOfDate is null", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "other",
        issueDate: "2569-01-01",
        effectiveDate: "2569-01-01",
      },
    })

    const result = await isOrderStale(order)
    assert.strictEqual(result.overallStatus, "latest")
  })
})

describe("getMaxSalaryEffectiveDate", () => {
  test("returns latest date from salary sources", async () => {
    const date = await getMaxSalaryEffectiveDate(personId)
    // Returns Date | null — at minimum the adjustment date 2568-12-25
    assert.ok(date instanceof Date, `Expected Date, got ${typeof date} (${date})`)
    const expected = new Date("2568-12-25")
    assert.ok(date.getTime() >= expected.getTime(), `Expected ${date.toISOString()} >= ${expected.toISOString()}`)
  })

  test("returns null for non-existent person", async () => {
    const date = await getMaxSalaryEffectiveDate(999999)
    assert.strictEqual(date, null)
  })
})

describe("validateOrderFreshness", () => {
  test("returns all 5 freshness flags", async () => {
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

    const updated = await prisma.order.findUnique({
      where: { id: order!.id },
    })
    assert.ok(updated)
    assert.strictEqual(updated!.statusSalary, result.statusSalary)
  })
})

describe("cascadeStaleCheck", () => {
  test("returns number for existing order", async () => {
    const order = await prisma.order.create({
      data: {
        employeeId: personId,
        orderType: "salary_apr",
        issueDate: "2569-04-01",
        effectiveDate: "2569-04-01",
        orderStatus: "active",
      },
    })

    const result = await cascadeStaleCheck(order.id)
    assert.ok(typeof result === "number")
  })

  test("returns 0 for non-existent order", async () => {
    const result = await cascadeStaleCheck(999999)
    assert.strictEqual(result, 0)
  })
})
