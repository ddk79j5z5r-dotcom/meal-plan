import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { planDay } from './calendar'
import { cookingPlan, cycleSummary, dayNutrition, productMap, purchases, sumCost, weeklyNeeds } from './plan'

const seed = () => createSeed(new Date(2026, 9, 6))

// Columns D/E («Ему»/«Ей») of «Закупка нед.1», in base units (g, ml, pcs; bread in slices).
const SHEET_NEEDS: Record<string, [number, number]> = {
  chicken_fillet: [1000, 600],
  chicken_thigh: [200, 450],
  beef_mince: [350, 0],
  beef: [400, 450],
  fish: [0, 600],
  tuna: [4, 0],
  eggs: [18, 4],
  cottage: [1400, 450],
  milk: [950, 0],
  syrok: [0, 14],
  cheese: [50, 0],
  bread: [9, 0],
  potato: [1350, 750],
  cucumber: [600, 900],
  tomato: [600, 900],
  zucchini: [700, 375],
  carrot: [450, 0],
  onion: [510, 0],
  pepper: [0, 375],
  broccoli: [300, 0],
  banana: [720, 0],
  apple: [300, 375],
  berries: [300, 100],
}

// Columns G («Остаток») and H («Купить») of weeks 1–4, base units.
const SHEET_WEEKS: Record<string, [number, number][]> = {
  eggs: [[0, 30], [8, 20], [6, 20], [4, 20]],
  cottage: [[0, 2000], [150, 1800], [100, 1800], [50, 1800]],
  milk: [[0, 1000], [50, 1000], [100, 1000], [150, 1000]],
  cheese: [[0, 100], [50, 0], [0, 100], [50, 0]],
  bread: [[0, 12], [3, 12], [6, 12], [9, 0]],
  chicken_thigh: [[0, 700], [50, 600], [0, 700], [50, 600]],
  zucchini: [[0, 1100], [25, 1100], [50, 1100], [75, 1000]],
  onion: [[0, 600], [90, 500], [80, 500], [70, 500]],
  banana: [[0, 800], [80, 700], [60, 700], [40, 700]],
  apple: [[0, 700], [25, 700], [50, 700], [75, 600]],
}

const SHEET_WEEK_TOTALS = [7521, 6968.5, 7258, 6808.5]

describe('weekly needs from the seed menu', () => {
  it('match the «Ему»/«Ей» columns of the workbook', () => {
    const needs = weeklyNeeds(seed().menu)
    for (const [id, [he, she]] of Object.entries(SHEET_NEEDS)) {
      expect(needs.get(id), id).toEqual({ he, she })
    }
  })

  it('match monthly staples (rice, oats, nuts, honey, peanut butter)', () => {
    const needs = weeklyNeeds(seed().menu)
    expect(needs.get('rice')).toEqual({ he: 520, she: 420 })
    expect(needs.get('oats')).toEqual({ he: 300, she: 0 })
    expect(needs.get('nuts')).toEqual({ he: 95, she: 30 })
    expect(needs.get('honey')).toEqual({ he: 30, she: 0 })
    expect(needs.get('peanut')).toEqual({ he: 40, she: 0 })
  })
})

describe('weekly purchases with carried-over leftovers', () => {
  it('reproduce «Остаток» and «Купить» for weeks 1–4', () => {
    const data = seed()
    for (let w = 0; w < 4; w++) {
      const rows = purchases(data, 'week', w)
      for (const [id, weeks] of Object.entries(SHEET_WEEKS)) {
        const row = rows.find((r) => r.product.id === id)!
        expect([row.leftover, row.buy], `${id} week ${w + 1}`).toEqual(weeks[w])
      }
    }
  })

  it('reproduce the weekly totals in ₽', () => {
    const data = seed()
    SHEET_WEEK_TOTALS.forEach((total, w) => {
      expect(sumCost(purchases(data, 'week', w))).toBeCloseTo(total, 6)
    })
  })

  it('honours a manual leftover override and carries it forward', () => {
    const data = seed()
    data.leftovers['w1:eggs'] = 0 // eggs went bad
    const w1 = purchases(data, 'week', 1).find((r) => r.product.id === 'eggs')!
    expect(w1).toMatchObject({ leftover: 0, leftoverOverridden: true, buy: 30 })
    const w2 = purchases(data, 'week', 2).find((r) => r.product.id === 'eggs')!
    expect(w2).toMatchObject({ leftover: 8, buy: 20 })
  })

  it('recalculates when the menu changes', () => {
    const data = seed()
    data.menu.he[0][0].items = [] // drop his day-1 oatmeal
    const milk = purchases(data, 'week', 0).find((r) => r.product.id === 'milk')!
    expect(milk.need).toBe(700)
    expect(milk.buy).toBe(1000)
  })
})

describe('monthly purchases', () => {
  it('buy staples for a 28-day cycle plus fixed oils and spices', () => {
    const rows = purchases(seed(), 'cycle', 0)
    const buy = Object.fromEntries(rows.map((r) => [r.product.id, r.buy]))
    expect(buy).toEqual({ rice: 4000, oats: 1500, nuts: 500, honey: 300, peanut: 300, oil_sun: 1000, oil_olive: 500, spices: 1 })
  })

  it('sum the cycle like the «Итого» sheet (without the day 29–30 tail)', () => {
    const s = cycleSummary(seed(), 0)
    expect(s.monthly).toBeCloseTo(2700) // workbook: 2850 for 30 days (nuts 0.6 kg instead of 0.5)
    expect(s.weeks).toEqual(SHEET_WEEK_TOTALS)
    expect(s.cookware).toBe(1880)
  })
})

describe('cooking plan', () => {
  it('matches the «План готовки» sheet', () => {
    const plan = cookingPlan(seed())
    const row = (code: string) => plan.find((r) => r.dish.code === code)!
    expect(row('Р3').portions.he.count).toBe(5)
    expect(row('Р3').portions.she.count).toBe(4)
    expect(row('Р3').totals.find((t) => t.productId === 'chicken_fillet')!.amount).toBe(1600)
    expect(row('Р2').totals).toEqual([{ productId: 'eggs', amount: 20 }])
    expect(row('Р15').portions.he.days).toEqual([3, 6])
    expect(row('Р7').portions.she.days).toEqual([2, 4, 6])
    expect(row('Р14').portions.he.count).toBe(8) // sheet says 7, but day 2 has potatoes twice
    expect(row('Р14').portions.she.count).toBe(5)
    expect(plan.some((r) => r.dish.code === 'Р12')).toBe(false)
  })
})

describe('nutrition', () => {
  // The workbook's «~2400 / ~1550 ккал» are optimistic; reference values give ~1900–2500 and ~1150–1400.
  it('stays in a sane range', () => {
    const data = seed()
    const products = productMap(data.products)
    for (const day of data.menu.he) expect(dayNutrition(day, products).kcal).toBeGreaterThan(1800)
    for (const day of data.menu.she) expect(dayNutrition(day, products).kcal).toBeGreaterThan(1100)
  })
})

describe('calendar', () => {
  it('maps dates to cycle days and weeks', () => {
    expect(planDay('2026-10-04', '2026-10-04')).toMatchObject({ menuDay: 0, week: 0, cycleDay: 0 })
    expect(planDay('2026-10-04', '2026-10-12')).toMatchObject({ menuDay: 1, week: 1, cycleDay: 8 })
    expect(planDay('2026-10-04', '2026-11-01')).toMatchObject({ menuDay: 0, week: 4, weekInCycle: 0, cycle: 1, cycleDay: 0 })
    expect(planDay('2026-10-04', '2026-10-03')).toMatchObject({ offset: -1, menuDay: 6 })
  })
})
