import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== salary_base_adjustments ===")
  const adj = await prisma.salaryBaseAdjustment.findMany()
  console.log(JSON.stringify(adj, null, 2))

  console.log("\n=== persons (count) ===")
  const pCount = await prisma.person.count()
  console.log("person count:", pCount)

  console.log("\n=== orders (count) ===")
  const oCount = await prisma.order.count()
  console.log("order count:", oCount)

  console.log("\n=== employee_change_log (count) ===")
  const logCount = await prisma.employeeChangeLog.count()
  console.log("change_log count:", logCount)

  console.log("\n=== salary_adjustment_applicants ===")
  const app = await prisma.salaryAdjustmentApplicant.findMany({ take: 5 })
  console.log(JSON.stringify(app, null, 2))

  console.log("\n=== orders (sample) ===")
  const orders = await prisma.order.findMany({ take: 3 })
  console.log(JSON.stringify(orders, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
