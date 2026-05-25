import { prisma } from "../../lib/prisma"

export async function seedFreshnessDb() {
  // Clean existing data in dependency order
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

  // Create an applicant with new salary (effective from adjustDate)
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
