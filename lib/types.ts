// Reusable Prisma result types for explicit typing
// Use these when Prisma's inferred types fail on Vercel builds

export interface OrderWithPerson {
  id: number
  orderType: string
  orderNo: string | null
  issueDate: string
  effectiveDate: string
  orderStatus: string
  statusSalary: string | null
  statusLevel: string | null
  statusPosition: string | null
  statusType: string | null
  statusOrg: string | null
  salary: number | null
  positionName: string | null
  positionType: string | null
  positionLevel: string | null
  createdAt?: Date
  person: {
    id?: number
    firstName: string | null
    lastName: string | null
  } | null
}

export interface OrderWithPersonMinimal {
  id: number
  orderNo: string | null
  orderType: string
  effectiveDate: string
  orderStatus: string
  statusSalary: string | null
  statusLevel: string | null
  statusOrg: string | null
  person?: {
    firstName: string | null
    lastName: string | null
  } | null
}

export interface PersonWithCount {
  id: number
  nameTitle: string | null
  firstName: string | null
  lastName: string | null
  citizenId: string | null
  currentPositionName: string | null
  currentPositionType: string | null
  currentPositionLevel: string | null
  currentBureau: string | null
  currentDivision: string | null
  currentDepartment: string | null
  currentMinistry: string | null
  currentSalary: number | null
  isActive: boolean
  _count: { orders: number }
}

export interface ChangeLogWithOrder {
  id: number
  changeType: string
  effectiveDate: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: Date
  order?: {
    id: number
    orderNo: string | null
    orderType: string
  } | null
}
