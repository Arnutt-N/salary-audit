import { format, parseISO, isValid } from "date-fns"
import { th } from "date-fns/locale"

const BUDDHIST_ERA_OFFSET = 543

/**
 * Format a date string (ISO 8601) to Thai พ.ศ. format
 * @example "2026-05-25" → "25 พ.ค. 2569"
 */
export function toThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = parseISO(dateStr)
  if (!isValid(d)) return dateStr
  return format(d, "d MMM ", { locale: th }) + (d.getFullYear() + BUDDHIST_ERA_OFFSET)
}

/**
 * Format to full Thai date with day name
 * @example "อาทิตย์ 25 พฤษภาคม 2569"
 */
export function toThaiDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = parseISO(dateStr)
  if (!isValid(d)) return dateStr
  return (
    format(d, "EEEE d MMMM ", { locale: th }) +
    (d.getFullYear() + BUDDHIST_ERA_OFFSET)
  )
}

/**
 * Convert พ.ศ. year to ค.ศ.
 */
export function toChristianYear(buddhistYear: number): number {
  return buddhistYear - BUDDHIST_ERA_OFFSET
}

/**
 * Convert ค.ศ. year to พ.ศ.
 */
export function toBuddhistYear(christianYear: number): number {
  return christianYear + BUDDHIST_ERA_OFFSET
}
