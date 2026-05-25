import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getBatches, POST as createBatch } from "../../app/api/batches/route"

let batch1Id: number

before(async () => {
  const data = await seedApiDb()
  batch1Id = data.batch1Id
})

describe("GET /api/batches", () => {
  test("returns all batches", async () => {
    const req = new Request("http://localhost/api/batches")
    const res = await getBatches(req as any)
    const body = await res.json()

    assert.ok(Array.isArray(body.batches))
    assert.ok(body.batches.length >= 2)
  })

  test("first batch has correct properties", async () => {
    const req = new Request("http://localhost/api/batches")
    const res = await getBatches(req as any)
    const body = await res.json()

    const batch = body.batches.find((b: any) => b.id === batch1Id)
    assert.ok(batch, "Batch not found in list")
    assert.strictEqual(batch.batchNo, "TEST-BATCH-001")
    assert.strictEqual(batch.batchType, "salary_oct")
    assert.strictEqual(batch.status, "draft")
  })
})

describe("POST /api/batches", () => {
  test("creates new batch", async () => {
    const req = new Request("http://localhost/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchNo: "TEST-BATCH-NEW",
        batchType: "salary_apr",
        effectiveDate: "2569-04-01",
        description: "Test batch from unit test",
      }),
    })
    const res = await createBatch(req as any)
    const body = await res.json()

    assert.strictEqual(res.status, 201)
    assert.ok(body.id)
    assert.strictEqual(body.batchNo, "TEST-BATCH-NEW")
  })

  test("returns 409 for duplicate batchNo", async () => {
    const req = new Request("http://localhost/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchNo: "TEST-BATCH-002", // already exists from fixture
        batchType: "salary_apr",
      }),
    })
    const res = await createBatch(req as any)

    assert.strictEqual(res.status, 409)
  })
})
