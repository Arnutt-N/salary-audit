import { z } from "zod"

export const orderSchema = z
  .object({
    employeeId: z.number().positive("กรุณาเลือกข้าราชการ"),
    orderType: z.string().min(1, "กรุณาเลือกประเภทคำสั่ง"),
    orderNo: z.string().optional().nullable(),
    issueDate: z.string().min(1, "กรุณาระบุวันที่ลงคำสั่ง"),
    effectiveDate: z.string().min(1, "กรุณาระบุวันที่มีผล"),
    salary: z.number().optional().nullable(),
    salaryAsOfDate: z.string().optional().nullable(),
    positionName: z.string().optional().nullable(),
    positionType: z.string().optional().nullable(),
    positionLevel: z.string().optional().nullable(),
    bureau: z.string().optional().nullable(),
    division: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    ministry: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      !data.salaryAsOfDate ||
      !data.effectiveDate ||
      data.salaryAsOfDate <= data.effectiveDate,
    {
      message: "เงินเดือน ณ วันที่ ต้องไม่เกินวันที่มีผล",
      path: ["salaryAsOfDate"],
    }
  )

export type OrderFormData = z.infer<typeof orderSchema>
