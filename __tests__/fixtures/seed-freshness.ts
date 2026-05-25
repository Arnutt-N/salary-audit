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
      adjustDate: "2568-12-25",
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

  // Create change log entries for current state (needed by getCurrentLevel/Position/Org)
  await prisma.employeeChangeLog.createMany({
    data: [
      {
        employeeId: person.id,
        changeType: "level",
        effectiveDate: "2568-01-01",
        oldValue: JSON.stringify({ position_level: "ปฏิบัติการ" }),
        newValue: JSON.stringify({ position_level: "ชำนาญการ" }),
      },
      {
        employeeId: person.id,
        changeType: "position",
        effectiveDate: "2568-01-01",
        oldValue: JSON.stringify({ position_name: "นักจัดการงานทั่วไปปฏิบัติการ", position_type: "ทั่วไป" }),
        newValue: JSON.stringify({ position_name: "นักจัดการงานทั่วไป", position_type: "วิชาการ" }),
      },
      {
        employeeId: person.id,
        changeType: "org",
        effectiveDate: "2568-01-01",
        oldValue: JSON.stringify({ bureau: "กองคลัง", division: "กลุ่มงานการเงิน", department: "กรมบัญชีกลาง", ministry: "กระทรวงการคลัง" }),
        newValue: JSON.stringify({ bureau: "กองการเจ้าหน้าที่", division: "กลุ่มงานทะเบียนประวัติ", department: "สำนักงานปลัดกระทรวง", ministry: "กระทรวงทดสอบ" }),
      },
    ],
  })

  return { personId: person.id, adjustmentId: adjustment.id }
}
