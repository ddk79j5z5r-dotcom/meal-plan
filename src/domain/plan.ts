import { WEEKS_PER_CYCLE } from './calendar'
import type { AppData, DayMenu, Dish, Ingredient, Menu, Nutrition, PersonId, Product } from './types'
import { PEOPLE } from './types'

export type ProductMap = Map<string, Product>
export const productMap = (products: Product[]): ProductMap => new Map(products.map((p) => [p.id, p]))

// ---------- Nutrition ----------

export const ZERO: Nutrition = { kcal: 0, p: 0, f: 0, c: 0 }

export function addN(a: Nutrition, b: Nutrition): Nutrition {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c }
}

export function gramsOf(product: Product, amount: number): number {
  return product.unit === 'pcs' ? amount * (product.pieceWeight ?? 0) : amount
}

export function nutritionOf(ingredients: Ingredient[], products: ProductMap): Nutrition {
  return ingredients.reduce((acc, i) => {
    const pr = products.get(i.productId)
    if (!pr) return acc
    const k = gramsOf(pr, i.amount) / 100
    return addN(acc, { kcal: pr.per100.kcal * k, p: pr.per100.p * k, f: pr.per100.f * k, c: pr.per100.c * k })
  }, ZERO)
}

export function dayNutrition(day: DayMenu, products: ProductMap): Nutrition {
  return day.reduce((acc, meal) => addN(acc, nutritionOf(meal.items.flatMap((i) => i.ingredients), products)), ZERO)
}

// ---------- Weekly needs ----------

export type Need = { he: number; she: number }

/** Total amount of every product the 7-day menu uses, per person, in base units. */
export function weeklyNeeds(menu: Menu): Map<string, Need> {
  const out = new Map<string, Need>()
  for (const person of PEOPLE) {
    for (const day of menu[person]) {
      for (const meal of day) {
        for (const item of meal.items) {
          for (const i of item.ingredients) {
            const n = out.get(i.productId) ?? { he: 0, she: 0 }
            n[person] += i.amount
            out.set(i.productId, n)
          }
        }
      }
    }
  }
  return out
}

// ---------- Purchases ----------

export type PeriodKind = 'week' | 'cycle'

export const periodKey = (kind: PeriodKind, index: number) => (kind === 'week' ? `w${index}` : `c${index}`)

export interface PurchaseRow {
  product: Product
  needHe: number
  needShe: number
  need: number
  leftover: number
  leftoverOverridden: boolean
  /** Amount to buy in base units, rounded up to the pack step. */
  buy: number
  cost: number
  /** Key used for checks and leftover overrides. */
  key: string
}

/** Round up to a multiple of `step`, ignoring float noise. */
export function roundUp(value: number, step: number): number {
  if (value <= 0) return 0
  if (step <= 0) return value
  return Math.ceil(value / step - 1e-9) * step
}

function periodNeed(product: Product, need: Need | undefined, kind: PeriodKind): Need {
  if (product.fixedPerCycle != null) return { he: 0, she: 0 }
  const k = kind === 'cycle' ? WEEKS_PER_CYCLE : 1
  return { he: (need?.he ?? 0) * k, she: (need?.she ?? 0) * k }
}

/**
 * Purchase list for one period (a week for weekly products, a 4-week cycle for monthly ones).
 * Leftovers carry over from period to period: leftover = previous leftover + bought − needed,
 * unless the user has overridden it.
 */
export function purchases(data: AppData, kind: PeriodKind, index: number): PurchaseRow[] {
  const needs = weeklyNeeds(data.menu)
  const frequency = kind === 'week' ? 'weekly' : 'monthly'
  const target = Math.max(0, index)
  const rows: PurchaseRow[] = []

  for (const product of data.products) {
    if (product.frequency !== frequency) continue
    const n = periodNeed(product, needs.get(product.id), kind)
    const need = product.fixedPerCycle ?? n.he + n.she
    if (need === 0) continue

    let carried = 0
    for (let i = 0; i <= target; i++) {
      const key = `${periodKey(kind, i)}:${product.id}`
      const override = data.leftovers[key]
      const leftover = override != null ? Math.max(0, override) : carried
      const buy = roundUp(need - leftover, product.packStep)
      if (i === target) {
        rows.push({
          product,
          needHe: n.he,
          needShe: n.she,
          need,
          leftover,
          leftoverOverridden: override != null,
          buy,
          cost: (buy / product.buyFactor) * product.price,
          key,
        })
      }
      carried = Math.max(0, leftover + buy - need)
    }
  }
  return rows
}

export const sumCost = (rows: PurchaseRow[]) => rows.reduce((s, r) => s + r.cost, 0)

export interface CycleSummary {
  monthly: number
  weeks: number[]
  food: number
  cookware: number
}

export function cycleSummary(data: AppData, cycle: number): CycleSummary {
  const c = Math.max(0, cycle)
  const monthly = sumCost(purchases(data, 'cycle', c))
  const weeks = Array.from({ length: WEEKS_PER_CYCLE }, (_, i) => sumCost(purchases(data, 'week', c * WEEKS_PER_CYCLE + i)))
  const cookware = data.cookware.reduce((s, x) => s + x.qty * x.price, 0)
  return { monthly, weeks, food: monthly + weeks.reduce((a, b) => a + b, 0), cookware }
}

// ---------- Weekly batch cooking ----------

export interface CookPortion {
  days: number[]
  count: number
}

export interface CookRow {
  dish: Dish
  portions: Record<PersonId, CookPortion>
  /** Total ingredients for the week, both people. */
  totals: Ingredient[]
}

/** What to cook on the cooking day: every batch dish in the 7-day menu, aggregated. */
export function cookingPlan(data: AppData): CookRow[] {
  const byDish = new Map<string, CookRow>()
  for (const person of PEOPLE) {
    data.menu[person].forEach((day, dayIdx) => {
      for (const meal of day) {
        for (const item of meal.items) {
          const dish = item.dishId ? data.dishes.find((x) => x.id === item.dishId) : undefined
          if (!dish?.batch) continue
          let row = byDish.get(dish.id)
          if (!row) {
            row = { dish, portions: { he: { days: [], count: 0 }, she: { days: [], count: 0 } }, totals: [] }
            byDish.set(dish.id, row)
          }
          const portion = row.portions[person]
          portion.count++
          if (!portion.days.includes(dayIdx + 1)) portion.days.push(dayIdx + 1)
          for (const i of item.ingredients) {
            const t = row.totals.find((x) => x.productId === i.productId)
            if (t) t.amount += i.amount
            else row.totals.push({ ...i })
          }
        }
      }
    })
  }
  const order = (d: Dish) => data.dishes.indexOf(d)
  return [...byDish.values()].sort((a, b) => order(a.dish) - order(b.dish))
}

// ---------- Formatting ----------

const num = (n: number, digits = 2) =>
  n.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/** Amount in base units for menus and recipes: «200 г», «250 мл», «2 шт». */
export function formatAmount(product: Product | undefined, amount: number): string {
  if (!product) return num(amount)
  if (product.unit === 'g') return `${num(amount, 0)} г`
  if (product.unit === 'ml') return `${num(amount, 0)} мл`
  return `${num(amount, 1)} ${product.pieceLabel ?? 'шт'}`
}

/** Amount converted to buy units: «1,6 кг», «0,75 буханка». */
export function formatBuy(product: Product, amount: number): string {
  return `${num(amount / product.buyFactor, 3)} ${product.buyUnit}`
}

/** Large amounts in kg/l, small ones in g/ml. */
export function formatBulk(product: Product, amount: number): string {
  if (product.unit !== 'pcs' && amount >= 1000) return formatBuy(product, amount)
  return formatAmount(product, amount)
}

export const formatRub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`
export const formatInt = (n: number) => Math.round(n).toLocaleString('ru-RU')
