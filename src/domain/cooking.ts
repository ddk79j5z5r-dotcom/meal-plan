import type { AppData, CookSpec, Dish, Ingredient, PersonId } from './types'
import { PEOPLE } from './types'

/** Used for custom batch dishes that have no cooking parameters yet. */
export const DEFAULT_SPEC: CookSpec = { where: 'stove', minutes: 30, prep: 10, prepText: '', fridgeDays: 3, freezes: true }

export const specOf = (dish: Dish): CookSpec => dish.cook ?? DEFAULT_SPEC

/** Where a portion eaten on `day` (0 = cooking day) waits until it is eaten. */
export type Place = 'fridge' | 'freezer' | 'fresh' | 'pantry'

export function placeFor(dish: Dish, day: number): Place {
  const spec = specOf(dish)
  if (spec.where === 'none') return 'pantry'
  if (day + 1 <= spec.fridgeDays) return 'fridge'
  if (spec.freshFrom != null && day + 1 >= spec.freshFrom) return 'fresh'
  return spec.freezes ? 'freezer' : 'fresh'
}

/** Menu day (0-based) on which a dish is cooked again, fresh, for the rest of the week. */
export const freshDay = (dish: Dish) => {
  const spec = specOf(dish)
  return spec.freshFrom != null ? spec.freshFrom - 1 : spec.fridgeDays
}

/** Air fryer batches needed for `portions`. */
export const batchesFor = (spec: CookSpec, portions: number) => (spec.where === 'airfryer' ? Math.max(1, Math.ceil(portions / (spec.batchSize || 1))) : 1)

export const portionCount = (row: CookRow) => row.portions.he.count + row.portions.she.count

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
  return menuPortions(data, (dish) => dish.batch)
}

function menuPortions(data: AppData, include: (dish: Dish) => boolean): Portion[] {
  const out: Portion[] = []
  for (const person of PEOPLE) {
    data.menu[person].forEach((meals, day) => {
      for (const meal of meals) {
        for (const item of meal.items) {
          const dish = item.dishId ? data.dishes.find((d) => d.id === item.dishId) : undefined
          if (!dish || !include(dish)) continue
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
    else if (p.place === 'fridge') row.fridge++
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

/** Dishes made on the day they are eaten (oatmeal, salad, sandwich…), not on the cooking day. */
export function dailyPlan(data: AppData): CookRow[] {
  return aggregate(
    menuPortions(data, (dish) => !dish.batch && !!dish.howTo),
    data.dishes,
  )
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

/** Dishes to prepare on the evening of `day` for the next day's meals (e.g. overnight oats). */
export function eveningPrep(data: AppData, day: number): Portion[] {
  const next = (day + 1) % 7
  return batchPortions(data).filter((p) => p.day === next && p.dish.cook?.evening)
}

/** Raw frozen ingredients to defrost overnight before cooking on `day` (0 = the cooking day). */
export function thawFor(data: AppData, day: number): CookRow[] {
  const rows = day === 0 ? cookingPlan(data) : (midweekPlan(data).find((m) => m.day === day)?.rows ?? [])
  return rows.filter((r) => r.dish.cook?.thaw)
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
  /** Minute it goes on the heat (air fryer: starts preheating); preparation runs in the minutes before. */
  start: number
  end: number
  /** Air fryer batches, each `spec.minutes` long. */
  batches: number
}

export interface Schedule {
  placed: Placed[]
  /** Everything is off the heat. */
  cookedAt: number
  /** Cooled and packed: the session is over. */
  total: number
}

export const COOL_MINUTES = 20
export const PACK_MINUTES = 15
/** Air fryer preheat before each dish, and the time to unload and reload between batches. */
export const AIRFRYER_PREHEAT = 3
export const AIRFRYER_RELOAD = 2
const BURNERS = 4

/** When each batch of an air fryer dish starts and ends. */
export function batchTimes(p: Pick<Placed, 'start' | 'batches' | 'spec'>): { start: number; end: number }[] {
  return Array.from({ length: p.batches }, (_, i) => {
    const start = p.start + AIRFRYER_PREHEAT + i * (p.spec.minutes + AIRFRYER_RELOAD)
    return { start, end: start + p.spec.minutes }
  })
}

const duration = (spec: CookSpec, batches: number) =>
  spec.where === 'airfryer' ? AIRFRYER_PREHEAT + batches * spec.minutes + (batches - 1) * AIRFRYER_RELOAD : spec.where === 'none' ? 0 : spec.minutes

/**
 * Greedy list scheduling with three resources: the cook (preparation and attended cooking),
 * four stove burners and the air fryer (one basket, one dish at a time, in batches).
 * At each step the dish that would finish last if delayed goes first (earliest start − duration).
 */
export function schedule(rows: CookRow[]): Schedule {
  const tasks = rows.map((row) => {
    const spec = specOf(row.dish)
    const batches = batchesFor(spec, portionCount(row))
    return { row, spec, batches, length: duration(spec, batches) }
  })
  const busy: Record<CookSpec['where'], { s: number; e: number }[]> = { stove: [], airfryer: [], none: [] }
  const capacity: Record<CookSpec['where'], number> = { stove: BURNERS, airfryer: 1, none: Infinity }
  const placed: Placed[] = []
  let cookFree = 0

  const fits = (where: CookSpec['where'], s: number, length: number) => busy[where].filter((x) => x.s < s + length && s < x.e).length < capacity[where]

  const earliest = (t: (typeof tasks)[number]) => {
    const base = cookFree + t.spec.prep
    const candidates = [base, ...busy[t.spec.where].map((x) => x.e).filter((e) => e > base)].sort((a, b) => a - b)
    return candidates.find((s) => fits(t.spec.where, s, t.length)) ?? Math.max(base, ...busy[t.spec.where].map((x) => x.e))
  }

  while (tasks.length > 0) {
    const options = tasks.map((t) => ({ t, s: earliest(t) }))
    const pick = options.sort((a, b) => a.s - a.t.length - (b.s - b.t.length) || b.t.length - a.t.length)[0]
    const { t, s } = pick
    busy[t.spec.where].push({ s, e: s + t.length })
    placed.push({ row: t.row, spec: t.spec, start: s, end: s + t.length, batches: t.batches })
    cookFree = t.spec.attended ? s + t.length : s
    tasks.splice(tasks.indexOf(t), 1)
  }

  placed.sort((a, b) => a.start - a.spec.prep - (b.start - b.spec.prep) || a.start - b.start)
  const cookedAt = Math.max(0, ...placed.map((p) => p.end))
  return { placed, cookedAt, total: cookedAt + COOL_MINUTES + PACK_MINUTES }
}

export const formatClock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h} ч ${m ? `${m} мин` : ''}`.trim() : `${m} мин`
}
