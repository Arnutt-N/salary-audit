import { z } from "zod"

export const batchSchema = z.object({
  batchNo: z.string().min(1, "กรุณากรอกเลขที่ชุด"),
  batchType: z.string().min(1, "กรุณาเลือกประเภท"),
  effectiveDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export type BatchFormData = z.infer<typeof batchSchema>
