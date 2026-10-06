import type { AppData, CookSpec, Dish, Ingredient, PersonId } from './types'
import { PEOPLE } from './types'

/** Used for custom batch dishes that have no cooking parameters yet. */
export const DEFAULT_SPEC: CookSpec = { where: 'stove', minutes: 30, prep: 10, prepText: '', fridgeDays: 3, freezes: true }

export const specOf = (dish: Dish): CookSpec => dish.cook ?? DEFAULT_SPEC

/** Where a portion eaten on `day` (0 = cooking day) waits until it is eaten. */
export type Place = 'fridge' | 'freezer' | 'fresh'

export function placeFor(dish: Dish, day: number): Place {
  const spec = specOf(dish)
  if (day + 1 <= spec.fridgeDays) return 'fridge'
  return spec.freezes ? 'freezer' : 'fresh'
}

/** Menu day (0-based) on which a non-freezable dish is cooked again for the rest of the week. */
export const freshDay = (dish: Dish) => specOf(dish).fridgeDays

// ---------- Portions of batch dishes in the 7-day menu ----------

export interface Portion {
  dish: Dish
  person: PersonId
  day: number
  meal: string
  ingredients: Ingredient[]
  place: Place
}

export function batchPortions(data: AppData): Portion[] {
  const out: Portion[] = []
  for (const person of PEOPLE) {
    data.menu[person].forEach((meals, day) => {
      for (const meal of meals) {
        for (const item of meal.items) {
          const dish = item.dishId ? data.dishes.find((d) => d.id === item.dishId) : undefined
          if (!dish?.batch) continue
          out.push({ dish, person, day, meal: meal.name, ingredients: item.ingredients, place: placeFor(dish, day) })
        }
      }
    })
  }
  return out
}

export interface CookPortion {
  /** Menu days, 1-based. */
  days: number[]
  count: number
}

export interface CookRow {
  dish: Dish
  portions: Record<PersonId, CookPortion>
  /** Total ingredients, both people. */
  totals: Ingredient[]
  fridge: number
  freezer: number
}

function aggregate(portions: Portion[], dishes: Dish[]): CookRow[] {
  const byDish = new Map<string, CookRow>()
  for (const p of portions) {
    let row = byDish.get(p.dish.id)
    if (!row) {
      row = { dish: p.dish, portions: { he: { days: [], count: 0 }, she: { days: [], count: 0 } }, totals: [], fridge: 0, freezer: 0 }
      byDish.set(p.dish.id, row)
    }
    const portion = row.portions[p.person]
    portion.count++
    if (!portion.days.includes(p.day + 1)) portion.days.push(p.day + 1)
    if (p.place === 'freezer') row.freezer++
    else row.fridge++
    for (const i of p.ingredients) {
      const t = row.totals.find((x) => x.productId === i.productId)
      if (t) t.amount += i.amount
      else row.totals.push({ ...i })
    }
  }
  return [...byDish.values()].sort((a, b) => dishes.indexOf(a.dish) - dishes.indexOf(b.dish))
}

/** What to cook on the cooking day: every batch portion that keeps (fridge or freezer). */
export function cookingPlan(data: AppData): CookRow[] {
  return aggregate(
    batchPortions(data).filter((p) => p.place !== 'fresh'),
    data.dishes,
  )
}

export interface MidweekCook {
  day: number
  rows: CookRow[]
}

/** Dishes that don't freeze and are cooked again mid-week, grouped by day. */
export function midweekPlan(data: AppData): MidweekCook[] {
  const fresh = batchPortions(data).filter((p) => p.place === 'fresh')
  const days = [...new Set(fresh.map((p) => freshDay(p.dish)))].sort((a, b) => a - b)
  return days.map((day) => ({ day, rows: aggregate(fresh.filter((p) => freshDay(p.dish) === day), data.dishes) }))
}

/** Freezer portions to move to the fridge on the evening of `day`, for the next day. */
export function eveningTransfers(data: AppData, day: number): Portion[] {
  return batchPortions(data).filter((p) => p.place === 'freezer' && p.day === day + 1)
}

/** Containers: one per person and meal that has at least one batch dish, grouped by day. */
export function containerPlan(data: AppData): { day: number; boxes: { person: PersonId; meal: string; portions: Portion[] }[] }[] {
  const portions = batchPortions(data)
  return Array.from({ length: 7 }, (_, day) => {
    const boxes: { person: PersonId; meal: string; portions: Portion[] }[] = []
    for (const p of portions.filter((x) => x.day === day)) {
      const box = boxes.find((b) => b.person === p.person && b.meal === p.meal)
      if (box) box.portions.push(p)
      else boxes.push({ person: p.person, meal: p.meal, portions: [p] })
    }
    return { day, boxes }
  })
}

/** Containers needed for the week: boxes holding anything that isn't kept loose. */
export const containerCount = (data: AppData) =>
  containerPlan(data).reduce((n, d) => n + d.boxes.filter((b) => b.portions.some((p) => !specOf(p.dish).loose)).length, 0)

// ---------- Timeline ----------

export interface Placed {
  row: CookRow
  spec: CookSpec
  /** Minute it goes on the heat; preparation runs in the minutes before. */
  start: number
  end: number
  /** Oven temperature to switch to when this dish goes in, if it differs from the current one. */
  setTemp?: number
  /** Temperature the oven is actually at while this dish is in (may differ from the recipe by a little). */
  ovenTemp?: number
}

export interface Schedule {
  placed: Placed[]
  /** When to switch the oven on, and to what. */
  preheat?: { at: number; temp: number }
  /** Everything is off the heat. */
  cookedAt: number
  /** Cooled and packed: the session is over. */
  total: number
}

export const COOL_MINUTES = 20
export const PACK_MINUTES = 15
const PREHEAT = 10
const BURNERS = 4
const OVEN_SLOTS = 2
/** Dishes can share the oven when their temperatures differ by no more than this. */
const OVEN_TOLERANCE = 20

interface Interval {
  s: number
  e: number
  temp?: number
}

/**
 * Greedy list scheduling with three resources: the cook (preparation and attended cooking),
 * stove burners and oven slots (dishes in the oven at once must have close temperatures).
 * At each step the dish that would finish last if delayed goes first (earliest start − duration).
 */
export function schedule(rows: CookRow[]): Schedule {
  const tasks = rows.map((row) => ({ row, spec: specOf(row.dish) }))
  const stove: Interval[] = []
  const oven: Interval[] = []
  const placed: Placed[] = []
  let cookFree = 0

  const fits = (spec: CookSpec, s: number) => {
    const e = s + spec.minutes
    const overlapping = (spec.where === 'oven' ? oven : stove).filter((x) => x.s < e && s < x.e)
    if (spec.where === 'stove') return overlapping.length < BURNERS
    return overlapping.length < OVEN_SLOTS && overlapping.every((x) => Math.abs((x.temp ?? 0) - (spec.temp ?? 0)) <= OVEN_TOLERANCE)
  }

  const earliest = (spec: CookSpec) => {
    const base = Math.max(cookFree + spec.prep, spec.where === 'oven' ? PREHEAT : 0)
    const candidates = [base, ...[...stove, ...oven].map((x) => x.e).filter((e) => e > base)].sort((a, b) => a - b)
    return candidates.find((s) => fits(spec, s)) ?? Math.max(base, ...[...stove, ...oven].map((x) => x.e))
  }

  while (tasks.length > 0) {
    // Long dishes first: the task whose earliest start minus its duration is smallest.
    const options = tasks.map((t) => ({ t, s: earliest(t.spec) }))
    const pick = options.sort((a, b) => a.s - a.t.spec.minutes - (b.s - b.t.spec.minutes) || b.t.spec.minutes - a.t.spec.minutes)[0]
    const { spec } = pick.t
    const interval = { s: pick.s, e: pick.s + spec.minutes, temp: spec.temp }
    ;(spec.where === 'oven' ? oven : stove).push(interval)
    placed.push({ row: pick.t.row, spec, start: interval.s, end: interval.e })
    cookFree = spec.attended ? interval.e : interval.s
    tasks.splice(tasks.indexOf(pick.t), 1)
  }

  placed.sort((a, b) => a.start - a.spec.prep - (b.start - b.spec.prep) || a.start - b.start)

  // Oven temperature changes, in the order dishes go in.
  let preheat: Schedule['preheat']
  let current: number | undefined
  for (const p of [...placed].filter((x) => x.spec.where === 'oven').sort((a, b) => a.start - b.start)) {
    const temp = p.spec.temp ?? 180
    if (current == null) {
      preheat = { at: Math.max(0, p.start - PREHEAT), temp }
      current = temp
    } else if (Math.abs(temp - current) > OVEN_TOLERANCE) {
      p.setTemp = temp
      current = temp
    }
    p.ovenTemp = current
  }

  const cookedAt = Math.max(0, ...placed.map((p) => p.end))
  return { placed, preheat, cookedAt, total: cookedAt + COOL_MINUTES + PACK_MINUTES }
}

export const formatClock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h} ч ${m ? `${m} мин` : ''}`.trim() : `${m} мин`
}
