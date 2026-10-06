export const CYCLE_DAYS = 28
export const WEEKS_PER_CYCLE = 4

const DAY_MS = 86_400_000

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + n)
  return toISO(date)
}

/** Whole days from `a` to `b`, immune to DST shifts. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

/** The latest Sunday on or before `today`. */
export function defaultStartDate(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() - d.getDay())
  return toISO(d)
}

export interface PlanDay {
  /** Days since start; negative before the plan starts. */
  offset: number
  /** 0–27 within the current cycle. */
  cycleDay: number
  /** 0–6: which template day of the menu. */
  menuDay: number
  /** Global week number from the start (0-based). */
  week: number
  /** 0–3 within the cycle. */
  weekInCycle: number
  cycle: number
}

export function planDay(startDate: string, date: string): PlanDay {
  const offset = daysBetween(startDate, date)
  const mod = (n: number, m: number) => ((n % m) + m) % m
  const cycleDay = mod(offset, CYCLE_DAYS)
  const week = Math.floor(offset / 7)
  return {
    offset,
    cycleDay,
    menuDay: mod(offset, 7),
    week,
    weekInCycle: mod(week, WEEKS_PER_CYCLE),
    cycle: Math.floor(offset / CYCLE_DAYS),
  }
}

export function weekStart(startDate: string, week: number): string {
  return addDays(startDate, week * 7)
}

const fmtDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const fmtLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

export const formatShort = (iso: string) => fmtDay.format(parseISO(iso)).replace('.', '')
export const formatLong = (iso: string) => fmtLong.format(parseISO(iso))

export function formatRange(startDate: string, week: number, days = 7): string {
  const a = weekStart(startDate, week)
  return `${formatShort(a)} – ${formatShort(addDays(a, days - 1))}`
}
