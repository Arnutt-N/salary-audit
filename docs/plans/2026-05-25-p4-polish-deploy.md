# P4 — Polish & Deploy Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make project production-ready: unit tests (node:test), Prisma indexes, documentation, CI test step, deploy prep.

**Architecture:** Node.js 20+ built-in test runner (`node:test` + `node:assert`) — zero extra deps. Test files import Prisma directly or import route handlers. No server start needed. Tests run via `npx tsx --test`.

**Tech Stack:** Node.js 20, TypeScript (tsx), Prisma 7, Next.js 16, node:test (built-in)

**Constraint:** `node_modules` broken on VPS — no `npm install`. All tests verified in CI only. Code changes are add-only (no deletion of working code).

**Test command:** `npx tsx --test` (tsx 4.x built-in test runner — verified in CI)

---

## Task 1: Create `__tests__/fixtures/seed-freshness.ts` — test data helper

**Objective:** Reusable seed function that creates minimal Prisma records for freshness tests

**Files:**
- Create: `__tests__/fixtures/seed-freshness.ts`

**Step 1: Create the fixture**

```typescript
import { prisma } from "@/lib/prisma"

export async function seedFreshnessDb() {
  // Clean existing data
  await prisma.employeeChangeLog.deleteMany()
  await prisma.compensationToSalary.deleteMany()
  await prisma.compensationDisbursement.deleteMany()
  await prisma.compensationRound.deleteMany()
  await prisma.employeeEducationAdjustment.deleteMany()
  await prisma.salaryAdjustmentApplicant.deleteMany()
  await prisma.salaryBaseAdjustment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.orderBatch.deleteMany()
  await prisma.person.deleteMany()

  // Create a person with known data
  const person = await prisma.person.create({
    data: {
      firstName: "ทดสอบ",
      lastName: "สดชื่น",
      currentPositionName: "นักจัดการงานทั่วไป",
      currentPositionType: "วิชาการ",
      currentPositionLevel: "ชำนาญการ",
      currentBureau: "กองการเจ้าหน้าที่",
      currentDivision: "กลุ่มงานทะเบียนประวัติ",
      currentDepartment: "สำนักงานปลัดกระทรวง",
      currentMinistry: "กระทรวงทดสอบ",
      currentSalary: 25000,
      isActive: true,
    },
  })

  // Create a salary base adjustment (later date)
  const adjustment = await prisma.salaryBaseAdjustment.create({
    data: {
      adjustDate: "2569-07-01",
      description: "ปรับอัตราเงินเดือนทั่วประเทศ 5%",
      multiplier: 1.05,
    },
  })

  // Create an applicant with new salary
  await prisma.salaryAdjustmentApplicant.create({
    data: {
      adjustmentId: adjustment.id,
      employeeId: person.id,
      oldSalary: 25000,
      newSalary: 26250,
    },
  })

  return { personId: person.id, adjustmentId: adjustment.id }
}
```

**Step 2: Verify**

```bash
node --import tsx -e "
  import { seedFreshnessDb } from './__tests__/fixtures/seed-freshness';
  seedFreshnessDb().then(d => console.log('personId:', d.personId));
"
```

Expected: prints `personId: N`

**Step 3: Commit**

```bash
git add __tests__/fixtures/seed-freshness.ts
git commit -m "test: add freshness test fixture with seed data"
```

---

## Task 2: Create `__tests__/freshness.test.ts` — freshness engine tests

**Objective:** Test all functions in `lib/freshness.ts` with edge cases

**Files:**
- Create: `__tests__/freshness.test.ts`

**Step 1: Create test file**

```typescript
import { test, describe, before, after } from "node:test"
import assert from "node:assert"
import { prisma } from "@/lib/prisma"
import {
  isOrderStale,
  validateOrderFreshness,
  getMaxSalaryEffectiveDate,
  cascadeStaleCheck,
} from "@/lib/freshness"
import { seedFreshnessDb } from "./fixtures/seed-freshness"

let personId: number
let orderId: number

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

    // This order itself should be excluded — it IS the correction
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
    const order = await prisma.order.findFirst({
      where: { employeeId: personId },
    })
    assert.ok(order)

    const result = await validateOrderFreshness(order!.id)
    assert.ok("statusSalary" in result)
    assert.ok("statusPosition" in result)
    assert.ok("statusType" in result)
    assert.ok("statusLevel" in result)
    assert.ok("statusOrg" in result)
  })
})

describe("cascadeStaleCheck", () => {
  test("returns affected orders when cascade needed", async () => {
    const result = await cascadeStaleCheck(personId, "2569-04-01")
    assert.ok(Array.isArray(result))
  })

  test("respects max_depth limit", async () => {
    const result = await cascadeStaleCheck(personId, "2569-04-01", 1)
    assert.ok(result.length <= 2) // max_depth=1 means at most 2 levels
  })
})
```

**Step 2: Verify**

```bash
npx tsx --test __tests__/freshness.test.ts 2>&1 | tail -5
```

Expected: `# tests N pass` (or `# pass N`)

**Step 3: Commit**

```bash
git add __tests__/freshness.test.ts
git commit -m "test: freshness engine tests — isStale, validateFreshness, cascade"
```

---

## Task 3: Create `__tests__/fixtures/seed-api.ts` — API test data

**Objective:** Seed data for API route tests

**Files:**
- Create: `__tests__/fixtures/seed-api.ts`

**Step 1: Create fixture**

```typescript
import { prisma } from "@/lib/prisma"

export async function seedApiDb() {
  // Clean
  await prisma.employeeChangeLog.deleteMany()
  await prisma.compensationToSalary.deleteMany()
  await prisma.compensationDisbursement.deleteMany()
  await prisma.compensationRound.deleteMany()
  await prisma.employeeEducationAdjustment.deleteMany()
  await prisma.salaryAdjustmentApplicant.deleteMany()
  await prisma.salaryBaseAdjustment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.orderBatch.deleteMany()
  await prisma.person.deleteMany()

  // Create 5 test persons
  const persons = []
  for (let i = 1; i <= 5; i++) {
    const p = await prisma.person.create({
      data: {
        firstName: `ทดสอบ${i}`,
        lastName: `นามสกุล${i}`,
        currentPositionName: "นักจัดการงานทั่วไป",
        currentPositionLevel: "ชำนาญการ",
        currentBureau: "กองการเจ้าหน้าที่",
        currentSalary: 20000 + i * 1000,
        isActive: true,
      },
    })
    persons.push(p)
  }

  // Create 2 test batches
  const batch1 = await prisma.orderBatch.create({
    data: {
      batchNo: "TEST-BATCH-001",
      batchType: "salary_oct",
      effectiveDate: "2568-10-01",
      status: "draft",
    },
  })

  const batch2 = await prisma.orderBatch.create({
    data: {
      batchNo: "TEST-BATCH-002",
      batchType: "promotion",
      effectiveDate: "2568-10-01",
      status: "approved",
    },
  })

  // Create orders for person 1 (one stale, one fresh)
  await prisma.order.create({
    data: {
      employeeId: persons[0].id,
      batchId: batch1.id,
      orderType: "salary_oct",
      orderNo: "TEST-001",
      issueDate: "2568-10-01",
      effectiveDate: "2568-10-01",
      salary: 15000, // different from current → stale
      orderStatus: "active",
      statusSalary: "stale",
    },
  })

  await prisma.order.create({
    data: {
      employeeId: persons[0].id,
      orderType: "transfer",
      orderNo: "TEST-002",
      issueDate: "2569-01-15",
      effectiveDate: "2569-02-01",
      salary: 21000,
      orderStatus: "active",
    },
  })

  // Create stale order for dashboard test
  await prisma.order.create({
    data: {
      employeeId: persons[1].id,
      orderType: "salary_apr",
      orderNo: "TEST-003",
      issueDate: "2569-04-01",
      effectiveDate: "2569-04-01",
      salary: 30000,
      orderStatus: "active",
      statusSalary: "stale",
      statusLevel: "stale",
    },
  })

  return {
    personIds: persons.map((p) => p.id),
    batch1Id: batch1.id,
    batch2Id: batch2.id,
  }
}
```

**Step 2: Verify**

```bash
node --import tsx -e "
  import { seedApiDb } from './__tests__/fixtures/seed-api';
  seedApiDb().then(d => console.log('persons:', d.personIds.length));
"
```

Expected: `persons: 5`

**Step 3: Commit**

```bash
git add __tests__/fixtures/seed-api.ts
git commit -m "test: add API test fixture with seed data"
```

---

## Task 4: Create `__tests__/api/employees.test.ts`

**Objective:** Test employee API route handlers

**Files:**
- Create: `__tests__/api/employees.test.ts`

**Step 1: Create test**

```typescript
import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getEmployees } from "@/app/api/employees/route"
import { GET as getEmployeeById } from "@/app/api/employees/[id]/route"

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
    assert.ok(body.persons.length <= 3)
    assert.ok(body.total >= 5)
    assert.strictEqual(body.page, 1)
    assert.strictEqual(body.limit, 50) // default PAGE_SIZE
  })

  test("search filters by name", async () => {
    const req = new Request("http://localhost/api/employees?search=ทดสอบ1")
    const res = await getEmployees(req as any)
    const body = await res.json()

    assert.ok(body.total >= 1)
    body.persons.forEach((p: any) => {
      assert.ok(
        p.firstName.includes("ทดสอบ1") || p.lastName.includes("ทดสอบ1")
      )
    })
  })

  test("active filter works", async () => {
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
  test("returns person by id", async () => {
    const req = new Request(`http://localhost/api/employees/${personIds[0]}`)
    const res = await getEmployeeById(req as any, {
      params: Promise.resolve({ id: String(personIds[0]) }),
    })
    const body = await res.json()

    assert.ok(body.firstName)
    assert.ok(body.lastName)
    assert.ok(typeof body.orderCount === "number")
    assert.ok(typeof body.staleCount === "number")
  })

  test("returns 404 for non-existing person", async () => {
    const req = new Request("http://localhost/api/employees/99999")
    const res = await getEmployeeById(req as any, {
      params: Promise.resolve({ id: "99999" }),
    })

    assert.strictEqual(res.status, 404)
    const body = await res.json()
    assert.ok(body.error)
  })
})
```

**Step 2: Verify**

```bash
npx tsx --test __tests__/api/employees.test.ts 2>&1 | tail -5
```

Expected: tests pass

**Step 3: Commit**

---

## Task 5: Create `__tests__/api/batches.test.ts`

**Objective:** Test batch API handlers

**Files:**
- Create: `__tests__/api/batches.test.ts`

**Step 1: Create test**

```typescript
import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getBatches, POST as createBatch } from "@/app/api/batches/route"

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
        batchNo: "TEST-BATCH-002", // already exists
        batchType: "salary_apr",
      }),
    })
    const res = await createBatch(req as any)

    assert.strictEqual(res.status, 409)
  })
})
```

**Step 2: Verify**

```bash
npx tsx --test __tests__/api/batches.test.ts 2>&1 | tail -5
```

Expected: tests pass

**Step 3: Commit**

---

## Task 6: Create `__tests__/api/dashboard.test.ts`

**Objective:** Test dashboard summary + stale API handlers

**Files:**
- Create: `__tests__/api/dashboard.test.ts`

**Step 1: Create test**

```typescript
import { test, describe, before } from "node:test"
import assert from "node:assert"
import { seedApiDb } from "../fixtures/seed-api"
import { GET as getSummary } from "@/app/api/dashboard/summary/route"
import { GET as getStale } from "@/app/api/dashboard/stale/route"

before(async () => {
  await seedApiDb()
})

describe("GET /api/dashboard/summary", () => {
  test("returns KPI counters", async () => {
    const req = new Request("http://localhost/api/dashboard/summary")
    const res = await getSummary()
    const body = await res.json()

    assert.ok(typeof body.totalOrders === "number")
    assert.ok(typeof body.totalActive === "number")
    assert.ok(typeof body.staleCount === "number")
    assert.ok(typeof body.totalBatches === "number")
    assert.ok(typeof body.pendingBatches === "number")
    assert.ok(typeof body.totalPersons === "number")
    assert.ok(typeof body.staleByType === "object")
    assert.ok(body.staleByType.salary >= 0)
  })
})

describe("GET /api/dashboard/stale", () => {
  test("returns stale orders", async () => {
    const req = new Request(
      "http://localhost/api/dashboard/stale?page=1&limit=10"
    )
    const res = await getStale(req as any)
    const body = await res.json()

    assert.ok(Array.isArray(body.orders))
    assert.ok(body.total >= 1) // at least one stale order from fixture
    body.orders.forEach((o: any) => {
      assert.ok(typeof o.warnings === "object")
      assert.ok(o.warnings.length > 0)
    })
  })
})
```

**Step 2: Verify**

```bash
npx tsx --test __tests__/api/dashboard.test.ts 2>&1 | tail -5
```

Expected: tests pass

**Step 3: Commit**

```bash
git add __tests__/api/dashboard.test.ts
git commit -m "test: dashboard API tests — summary, stale"
```

---

## Task 7: Add Prisma indexes (2 indexes)

**Objective:** Add performance-critical indexes

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add indexes**

After the Order model's existing indexes (around line 92):

Add:
```prisma
  @@index([orderStatus, statusSalary])
```

After the EmployeeChangeLog model (around line 155):

Add:
```prisma
  @@index([employeeId, createdAt])
```

**Step 2: Verify complete schema**

Look for the two lines in schema.prisma:

```bash
grep '@@index' prisma/schema.prisma
```

Expected: shows 4 indexes (2 existing + 2 new)

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "perf: add indexes on [orderStatus,statusSalary] and [employeeId,createdAt]"
```

---

## Task 8: Update CI — add test step

**Objective:** CI runs tests automatically

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add test step**

After the "Seed test data" step (line 50), add:

```yaml
      - name: Run tests
        run: npx tsx --test __tests__/freshness.test.ts __tests__/api/employees.test.ts __tests__/api/batches.test.ts __tests__/api/dashboard.test.ts
        env:
          DATABASE_URL: "file:./dev.db"
```

**Step 2: Verify**

```bash
grep -A3 "Run tests" .github/workflows/ci.yml
```

Expected: shows the test step with correct command

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add unit test step using node:test"
```

---

## Task 9: Write `.env.example`

**Objective:** Document required environment variables

**Files:**
- Create: `.env.example`

**Step 1: Create file**

```env
# ─── Database ───
# SQLite (development / CI)
DATABASE_URL="file:./dev.db"
# MySQL (production — TiDB Cloud)
# DATABASE_URL="mysql://user:password@host:4000/salary_audit"

# ─── Auth.js ───
# Generate with: openssl rand -base64 32
AUTH_SECRET="your-secret-here"

# ─── Deployment ───
# Vercel auto-detects Next.js. Set these in Vercel dashboard:
# 1. DATABASE_URL
# 2. AUTH_SECRET
# 3. NODE_VERSION=20

# ─── Optional ───
# SENTRY_DSN= (error tracking — P5)
```

**Step 2: Verify**

```bash
cat .env.example
```

Expected: all variables documented

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with required env vars"
```

---

## Task 10: Write `README.md`

**Objective:** Complete project documentation in Thai

**Files:**
- Overwrite: `README.md`

**Step 1: Create README**

```markdown
# Salary Audit — ระบบตรวจสอบคำสั่งข้าราชการ

ระบบตรวจสอบความถูกต้องของข้อมูลในคำสั่งข้าราชการ (HR Order Freshness Check) — ให้ข้อมูลในคำสั่งตรงกับข้อเท็จจริง ณ `effective_date` ของคำสั่งนั้นเสมอ

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| CSS | Tailwind CSS v4 + shadcn/ui |
| Database | SQLite (dev) / TiDB Cloud (prod) |
| ORM | Prisma 7 + `@prisma/adapter-libsql` |
| Auth | Auth.js (NextAuth v5) — Credentials |
| Font | Noto Sans Thai |

## 🚀 Quick Start

```bash
# 1. Clone
git clone git@github.com:Arnutt-N/salary-audit.git
cd salary-audit

# 2. Install
npm install

# 3. Environment
cp .env.example .env
# Edit .env — set AUTH_SECRET (gen with: openssl rand -base64 32)

# 4. Database
npx prisma db push
npx tsx prisma/seed.ts

# 5. Run
npm run dev
# → http://localhost:3000
```

## 🔑 Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `password` |

> Created by `prisma/seed.ts`. Change password after first login!

## 📁 Project Structure

```
app/
├── dashboard/        # แผงควบคุม (KPI + activity + stale)
├── employees/        # รายชื่อข้าราชการ
│   └── [id]/         # ข้อมูลบุคคล (timeline + change log)
├── batches/          # ชุดคำสั่ง (batch CRUD + approval)
│   └── [id]/         # รายละเอียด batch
├── reports/          # รายงาน
│   └── audit/        # Audit trail
├── orders/           # คำสั่ง (planned)
├── login/            # หน้า login
├── api/              # API routes
lib/                  # Core logic
├── freshness.ts       # Freshness engine
├── prisma.ts          # Prisma client
├── auth.ts            # Auth.js config
└── date-utils.ts      # Thai date (พ.ศ.)
prisma/               # Database
├── schema.prisma      # 10 tables
├── seed.ts            # Test data
└── prisma.config.ts   # Prisma 7 config
__tests__/            # Tests
```

## 📜 Available Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npx prisma db push # Apply schema changes
npx tsx prisma/seed.ts  # Seed test data
npx tsx --test __tests__/*.test.ts  # Run tests
```

## ✅ CI/CD

CI runs on every push and pull request: install → prisma generate → db push → lint → build → seed → **test** → type check

## 📖 Domain Context

See `hr-order-freshness-check-v2.md` for full spec of all 10 HR order scenarios (A-J), lifecycle states, and freshness checking logic.

## 📄 License

Private — Arnutt-N
```

**Step 2: Verify**

```bash
wc -l README.md  # should be ~100+ lines
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: comprehensive README in Thai with setup, structure, and commands"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsx --test __tests__/freshness.test.ts` — all freshness tests pass
- [ ] `npx tsx --test __tests__/api/employees.test.ts` — employee API tests pass
- [ ] `npx tsx --test __tests__/api/batches.test.ts` — batch API tests pass
- [ ] `npx tsx --test __tests__/api/dashboard.test.ts` — dashboard API tests pass
- [ ] `grep '@@index' prisma/schema.prisma | wc -l` → 4 indexes
- [ ] `grep 'Run tests' .github/workflows/ci.yml` — test step exists
- [ ] `.env.example` exists with AUTH_SECRET and DATABASE_URL
- [ ] `README.md` > 80 lines, has Quick Start + Login + Structure
- [ ] CI green on push — all steps including tests pass

---

*PRP v1.0 — P4 Polish & Deploy — 25 พ.ค. 2569*
