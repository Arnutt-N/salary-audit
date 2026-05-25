import { prisma } from "../../lib/prisma"

export async function seedApiDb() {
  // Clean in dependency order
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

  // Orders for person 1 (one stale, one fresh)
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

  // Stale order for dashboard test (person 2)
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
