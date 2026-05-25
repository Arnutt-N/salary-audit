import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getSummary } from "../../../app/api/dashboard/summary/route"
import { GET as getStale } from "../../../app/api/dashboard/stale/route"

before(async () => {
  await seedApiDb()
})

describe("GET /api/dashboard/summary", () => {
  test("returns KPI counters with correct types", async () => {
    const res = await getSummary()
    const body = await res.json()

    assert.ok(typeof body.totalOrders === "number")
    assert.ok(typeof body.activeOrders === "number")
    assert.ok(typeof body.staleCount === "number")
    assert.ok(typeof body.totalBatches === "number")
    assert.ok(typeof body.pendingBatches === "number")
    assert.ok(typeof body.totalPersons === "number")
  })

  test("staleByType has all 5 freshness dimensions", async () => {
    const res = await getSummary()
    const body = await res.json()

    assert.ok(typeof body.staleByType === "object")
    assert.ok(body.staleByType.salary >= 0)
    assert.ok(body.staleByType.level >= 0)
    assert.ok(body.staleByType.position >= 0)
    assert.ok(body.staleByType.type >= 0)
    assert.ok(body.staleByType.org >= 0)
  })

  test("staleCount matches sum of staleByType", async () => {
    const res = await getSummary()
    const body = await res.json()

    const sum =
      body.staleByType.salary +
      body.staleByType.level +
      body.staleByType.position +
      body.staleByType.type +
      body.staleByType.org

    // Note: one order can have multiple stale flags,
    // so sum can be > staleCount. Just verify it's not less.
    assert.ok(sum >= body.staleCount)
  })
})

describe("GET /api/dashboard/stale", () => {
  test("returns stale orders with warnings", async () => {
    const req = new Request(
      "http://localhost/api/dashboard/stale?page=1&limit=10"
    )
    const res = await getStale(req as any)
    const body = await res.json()

    assert.ok(Array.isArray(body.orders))
    assert.ok(body.total >= 1) // at least one stale order from fixture
    body.orders.forEach((o: any) => {
      assert.ok(Array.isArray(o.warnings))
      assert.ok(o.warnings.length > 0, "Expected warnings on stale order")
    })
  })

  test("enriched orders have overallStatus", async () => {
    const req = new Request(
      "http://localhost/api/dashboard/stale?page=1&limit=10"
    )
    const res = await getStale(req as any)
    const body = await res.json()

    body.orders.forEach((o: any) => {
      assert.ok(typeof o.overallStatus === "string")
    })
  })
})
