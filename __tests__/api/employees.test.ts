/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getEmployees } from "../../app/api/employees/route"
import { GET as getEmployeeById } from "../../app/api/employees/[id]/route"

let personIds: number[]

before(async () => {
  const data = await seedApiDb()
  personIds = data.personIds
})

describe("GET /api/employees", () => {
  test("returns paginated list", async () => {
    const req = new Request("http://localhost/api/employees?page=1&limit=3")
    const res = await getEmployees(req as any)
    const body = await res.json()

    assert.ok(Array.isArray(body.persons))
    assert.ok(body.persons.length <= 50) // PAGE_SIZE default
    assert.ok(body.total >= 5)
    assert.strictEqual(body.page, 1)
    assert.strictEqual(body.limit, 50)
  })

  test("search filters by name", async () => {
    const req = new Request(
      "http://localhost/api/employees?search=ทดสอบ1"
    )
    const res = await getEmployees(req as any)
    const body = await res.json()

    assert.ok(body.total >= 1)
    body.persons.forEach((p: any) => {
      const fullName = `${p.firstName} ${p.lastName}`
      assert.ok(fullName.includes("ทดสอบ1"), `Expected "ทดสอบ1" in "${fullName}"`)
    })
  })

  test("active filter returns only active persons", async () => {
    const req = new Request(
      "http://localhost/api/employees?active=true"
    )
    const res = await getEmployees(req as any)
    const body = await res.json()

    body.persons.forEach((p: any) => {
      assert.strictEqual(p.isActive, true)
    })
  })
})

describe("GET /api/employees/[id]", () => {
  test("returns person by id with counts", async () => {
    const req = new Request(
      `http://localhost/api/employees/${personIds[0]}`
    )
    const res = await getEmployeeById(req as any, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: Promise.resolve({ id: String(personIds[0]) }) as any,
    })
    const body = await res.json()

    assert.ok(body.firstName)
    assert.ok(body.lastName)
    assert.ok(typeof body.orderCount === "number")
    assert.ok(typeof body.staleCount === "number")
    assert.ok(typeof body.changeLogCount === "number")
  })

  test("returns 404 for non-existing person", async () => {
    const req = new Request("http://localhost/api/employees/99999")
    const res = await getEmployeeById(req as any, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: Promise.resolve({ id: "99999" }) as any,
    })

    assert.strictEqual(res.status, 404)
    const body = await res.json()
    assert.ok(body.error)
  })
})
