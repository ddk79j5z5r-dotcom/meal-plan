import { WEEKS_PER_CYCLE } from './calendar'
import type { AppData, Category, DayMenu, Ingredient, Menu, Nutrition, PersonId, Product } from './types'
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

/** Price per buy unit in effect in `week`: the latest change at or before it, else the base price. */
export function priceAt(data: AppData, productId: string, week: number): number {
  const product = data.products.find((p) => p.id === productId)
  let best = -1
  let price = product?.price ?? 0
  for (const [w, value] of Object.entries(data.prices?.[productId] ?? {})) {
    const n = Number(w)
    if (n <= week && n > best) {
      best = n
      price = value
    }
  }
  return price
}

/** First week of a purchase period: cycles are priced at their first week. */
export const priceWeek = (kind: PeriodKind, index: number) => (kind === 'week' ? index : index * WEEKS_PER_CYCLE)

export interface PurchaseRow {
  product: Product
  needHe: number
  needShe: number
  need: number
  leftover: number
  leftoverOverridden: boolean
  /** Amount to buy in base units, rounded up to the pack step. */
  buy: number
  /** Price per buy unit in effect for this period. */
  price: number
  /** The price was changed exactly in this period's week. */
  priceSetHere: boolean
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
export function purchases(data: AppData, kind: PeriodKind, index: number, opts: { basePrices?: boolean } = {}): PurchaseRow[] {
  const needs = weeklyNeeds(data.menu)
  const frequency = kind === 'week' ? 'weekly' : 'monthly'
  const target = Math.max(0, index)
  const week = priceWeek(kind, target)
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
        const price = opts.basePrices ? product.price : priceAt(data, product.id, week)
        rows.push({
          product,
          needHe: n.he,
          needShe: n.she,
          need,
          leftover,
          leftoverOverridden: override != null,
          buy,
          price,
          priceSetHere: data.prices?.[product.id]?.[week] != null,
          cost: (buy / product.buyFactor) * price,
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

// ---------- Price statistics ----------

export interface CategoryCost {
  category: Category
  cost: number
}

export interface ProductCost {
  product: Product
  cost: number
}

export interface PriceChange {
  product: Product
  base: number
  current: number
  /** Relative change, 0.1 = +10 %. */
  change: number
}

export interface CycleStats {
  summary: CycleSummary
  perDay: number
  perPersonDay: Record<PersonId, number>
  byCategory: CategoryCost[]
  top: ProductCost[]
  changes: PriceChange[]
  /** Food cost of the cycle at base prices, to show how much price changes moved it. */
  foodAtBase: number
  previousFood?: number
}

export function cycleStats(data: AppData, cycle: number): CycleStats {
  const c = Math.max(0, cycle)
  const periods: [PeriodKind, number][] = [['cycle', c], ...Array.from({ length: WEEKS_PER_CYCLE }, (_, i) => ['week', c * WEEKS_PER_CYCLE + i] as [PeriodKind, number])]
  const rows = periods.flatMap(([k, i]) => purchases(data, k, i))
  const baseRows = periods.flatMap(([k, i]) => purchases(data, k, i, { basePrices: true }))

  const person: Record<PersonId, number> = { he: 0, she: 0 }
  const byCat = new Map<Category, number>()
  const byProduct = new Map<string, ProductCost>()
  for (const r of rows) {
    const heShare = r.product.fixedPerCycle != null || r.needHe + r.needShe === 0 ? 0.5 : r.needHe / (r.needHe + r.needShe)
    person.he += r.cost * heShare
    person.she += r.cost * (1 - heShare)
    byCat.set(r.product.category, (byCat.get(r.product.category) ?? 0) + r.cost)
    const pc = byProduct.get(r.product.id) ?? { product: r.product, cost: 0 }
    pc.cost += r.cost
    byProduct.set(r.product.id, pc)
  }

  const lastWeek = c * WEEKS_PER_CYCLE + WEEKS_PER_CYCLE - 1
  const changes = data.products
    .map((product) => ({ product, base: product.price, current: priceAt(data, product.id, lastWeek) }))
    .filter((x) => x.current !== x.base)
    .map((x) => ({ ...x, change: x.base ? x.current / x.base - 1 : 0 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  const summary = cycleSummary(data, c)
  const days = WEEKS_PER_CYCLE * 7
  return {
    summary,
    perDay: summary.food / days,
    perPersonDay: { he: person.he / days, she: person.she / days },
    byCategory: [...byCat].map(([category, cost]) => ({ category, cost })).filter((x) => x.cost > 0).sort((a, b) => b.cost - a.cost),
    top: [...byProduct.values()].sort((a, b) => b.cost - a.cost).slice(0, 5),
    changes,
    foodAtBase: sumCost(baseRows),
    previousFood: c > 0 ? cycleSummary(data, c - 1).food : undefined,
  }
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
