import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { planDay } from './calendar'
import { cycleStats, cycleSummary, dayNutrition, priceAt, productMap, purchases, sumCost, weeklyNeeds } from './plan'

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

describe('weekly prices', () => {
  it('apply from their week onwards and leave earlier weeks alone', () => {
    const data = seed()
    data.prices.eggs = { 2: 15 }
    expect(priceAt(data, 'eggs', 1)).toBe(13)
    expect(priceAt(data, 'eggs', 2)).toBe(15)
    expect(priceAt(data, 'eggs', 9)).toBe(15)
    data.prices.eggs[5] = 14
    expect(priceAt(data, 'eggs', 4)).toBe(15)
    expect(priceAt(data, 'eggs', 6)).toBe(14)

    const w1 = purchases(data, 'week', 1).find((r) => r.product.id === 'eggs')!
    const w2 = purchases(data, 'week', 2).find((r) => r.product.id === 'eggs')!
    expect(w1).toMatchObject({ price: 13, priceSetHere: false, cost: 20 * 13 })
    expect(w2).toMatchObject({ price: 15, priceSetHere: true, cost: 20 * 15 })
  })

  it('price monthly purchases at the first week of the cycle', () => {
    const data = seed()
    data.prices.rice = { 4: 200 }
    expect(purchases(data, 'cycle', 0).find((r) => r.product.id === 'rice')!.price).toBe(140)
    expect(purchases(data, 'cycle', 1).find((r) => r.product.id === 'rice')!.price).toBe(200)
  })
})

describe('cycle statistics', () => {
  it('split the cost by person and category and list price changes', () => {
    const data = seed()
    const base = cycleStats(data, 0)
    expect(base.perDay * 28).toBeCloseTo(base.summary.food)
    expect(base.perPersonDay.he + base.perPersonDay.she).toBeCloseTo(base.perDay)
    expect(base.perPersonDay.he).toBeGreaterThan(base.perPersonDay.she)
    expect(base.byCategory.reduce((s, c) => s + c.cost, 0)).toBeCloseTo(base.summary.food)
    expect(base.byCategory[0].category).toBe('Мясо и рыба')
    expect(base.top).toHaveLength(5)
    expect(base.changes).toEqual([])
    expect(base.foodAtBase).toBeCloseTo(base.summary.food)

    data.prices.chicken_fillet = { 2: 528 } // +10 % from week 3
    const s = cycleStats(data, 0)
    expect(s.changes).toMatchObject([{ base: 480, current: 528 }])
    expect(s.changes[0].change).toBeCloseTo(0.1)
    expect(s.summary.food - s.foodAtBase).toBeCloseTo(2 * 1.6 * 48)
  })
})
