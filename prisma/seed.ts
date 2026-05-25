import { prisma } from "../lib/prisma"

async function main() {
  // Clean
  await prisma.compensationToSalary.deleteMany()
  await prisma.compensationDisbursement.deleteMany()
  await prisma.compensationRound.deleteMany()
  await prisma.employeeChangeLog.deleteMany()
  await prisma.employeeEducationAdjustment.deleteMany()
  await prisma.salaryAdjustmentApplicant.deleteMany()
  await prisma.order.deleteMany()
  await prisma.person.deleteMany()

  // 1. Create person
  const person = await prisma.person.create({
    data: {
      firstName: "นางสาวสมหญิง",
      lastName: "ใจดี",
      currentPositionName: "นักวิชาการเงินและบัญชีปฏิบัติการ",
      currentPositionType: "วิชาการ",
      currentPositionLevel: "ปฏิบัติการ",
      currentBureau: "กองคลัง",
      currentDepartment: "กรมบัญชีกลาง",
      currentMinistry: "กระทรวงการคลัง",
      currentSalary: 20000,
      salarySystemType: "พลเรือน",
      isActive: true,
    },
  })

  // 2. Create salary increase order (1 เม.ย. 2568)
  const order1 = await prisma.order.create({
    data: {
      employeeId: person.id,
      orderType: "salary_increase",
      orderNo: "ลน.2568/001",
      issueDate: "2025-04-01",
      effectiveDate: "2025-04-01",
      salary: 21000,
      salaryAsOfDate: "2025-04-01",
      positionName: "นักวิชาการเงินและบัญชีปฏิบัติการ",
      positionType: "วิชาการ",
      positionLevel: "ปฏิบัติการ",
      bureau: "กองคลัง",
      department: "กรมบัญชีกลาง",
      ministry: "กระทรวงการคลัง",
      orderStatus: "active",
    },
  })

  // 3. Create transfer order (15 มิ.ย. 2568) — references old salary
  const order2 = await prisma.order.create({
    data: {
      employeeId: person.id,
      orderType: "transfer",
      orderNo: "ลน.2568/002",
      issueDate: "2025-06-15",
      effectiveDate: "2025-06-15",
      salary: 20000, // old salary! should be 21000
      salaryAsOfDate: "2025-04-01",
      positionName: "นักวิชาการเงินและบัญชีปฏิบัติการ",
      positionType: "วิชาการ",
      positionLevel: "ปฏิบัติการ",
      bureau: "กองพัสดุ",
      department: "กรมบัญชีกลาง",
      ministry: "กระทรวงการคลัง",
      orderStatus: "active",
    },
  })

  // 4. Change logs
  await prisma.employeeChangeLog.createMany({
    data: [
      {
        employeeId: person.id,
        changeType: "level",
        effectiveDate: "2025-04-01",
        orderId: order1.id,
        oldValue: JSON.stringify({ position_level: null }),
        newValue: JSON.stringify({ position_level: "ปฏิบัติการ" }),
      },
      {
        employeeId: person.id,
        changeType: "position",
        effectiveDate: "2025-04-01",
        orderId: order1.id,
        oldValue: JSON.stringify({ position_name: null, position_type: null }),
        newValue: JSON.stringify({
          position_name: "นักวิชาการเงินและบัญชีปฏิบัติการ",
          position_type: "วิชาการ",
        }),
      },
      {
        employeeId: person.id,
        changeType: "org",
        effectiveDate: "2025-04-01",
        orderId: order1.id,
        oldValue: JSON.stringify({ bureau: null, department: null, ministry: null }),
        newValue: JSON.stringify({
          bureau: "กองคลัง",
          department: "กรมบัญชีกลาง",
          ministry: "กระทรวงการคลัง",
        }),
      },
    ],
  })

  // 5. System adjustments
  const adj67 = await prisma.salaryBaseAdjustment.create({
    data: { adjustDate: "2024-05-01", description: "ปรับอัตรา 1 พ.ค. 2567", multiplier: 1.05 },
  })
  const adj68 = await prisma.salaryBaseAdjustment.create({
    data: { adjustDate: "2025-05-01", description: "ปรับอัตรา 1 พ.ค. 2568", multiplier: 1.08 },
  })

  await prisma.salaryAdjustmentApplicant.create({
    data: {
      adjustmentId: adj68.id,
      employeeId: person.id,
      oldSalary: 21000,
      newSalary: 22680,
    },
  })

  console.log(`✅ Seeded: Person#${person.id}, Orders#${order1.id},#${order2.id}`)
  console.log(`   Salary adjustments: ${adj67.adjustDate}, ${adj68.adjustDate}`)
  console.log(`   Try: Transfer Order#${order2.id} has salary=20000 but should be ≥21000 → should be stale`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
