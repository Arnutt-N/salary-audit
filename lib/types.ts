// Reusable Prisma result types for explicit typing
// Use these when Prisma's inferred types fail on Vercel builds

type PersonName = {
  firstName: string | null
  lastName: string | null
}

type PersonLink = PersonName & {
  id: number
}

type OrderFreshnessFields = {
  statusSalary: string | null
  statusLevel: string | null
  statusPosition: string | null
  statusType: string | null
  statusOrg: string | null
}

type OrderCore = OrderFreshnessFields & {
  id: number
  orderType: string
  orderNo: string | null
  issueDate?: string
  effectiveDate: string
  orderStatus: string
  salary?: number | null
  positionName?: string | null
  positionType?: string | null
  positionLevel?: string | null
}

export type RecentOrderWithPerson = OrderCore & {
  createdAt: Date
  person: PersonLink
}

export type StaleOrderWithPerson = OrderCore & {
  person: PersonName
}

export type EmployeeOrderResult = OrderCore & {
  issueDate: string
  salary: number | null
  positionName: string | null
  positionType?: string | null
  positionLevel?: string | null
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
  person?: PersonName | null
}

export interface PersonListItem {
  id: number
  nameTitle: string | null
  firstName: string | null
  lastName: string | null
  currentPositionName: string | null
  currentPositionType: string | null
  currentPositionLevel: string | null
  currentBureau: string | null
  isActive: boolean
  _count: { orders: number }
}

export interface PersonWithCount extends PersonListItem {
  citizenId: string | null
  currentDivision: string | null
  currentDepartment: string | null
  currentMinistry: string | null
  currentSalary: number | null
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

export interface AuditChangeResult extends ChangeLogWithOrder {
  person: PersonLink
  order: {
    id: number
    orderNo: string | null
    orderType: string
    effectiveDate: string
  } | null
}
