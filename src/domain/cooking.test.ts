import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { migrate } from '../store'
import { containerCount, containerPlan, cookingPlan, eveningTransfers, midweekPlan, schedule } from './cooking'

const seed = () => createSeed(new Date(2026, 9, 6))

describe('cooking day plan', () => {
  it('matches the «План готовки» sheet for dishes that keep', () => {
    const plan = cookingPlan(seed())
    const row = (code: string) => plan.find((r) => r.dish.code === code)!
    expect(row('Р3').portions.he.count).toBe(5)
    expect(row('Р3').portions.she.count).toBe(4)
    expect(row('Р3').totals.find((t) => t.productId === 'chicken_fillet')!.amount).toBe(1600)
    expect(row('Р2').totals).toEqual([{ productId: 'eggs', amount: 20 }])
    expect(row('Р15').portions.he.days).toEqual([3, 6])
    expect(row('Р7').portions.she.days).toEqual([2, 4, 6])
    expect(plan.some((r) => r.dish.code === 'Р12')).toBe(false)
  })

  it('freezes portions past their fridge life', () => {
    const fillet = cookingPlan(seed()).find((r) => r.dish.code === 'Р3')!
    // he: days 1,3,4,5,6; she: days 1,3,4,6 → fridge for days 1–3
    expect(fillet.fridge).toBe(4)
    expect(fillet.freezer).toBe(5)
    const fish = cookingPlan(seed()).find((r) => r.dish.code === 'Р8')!
    expect(fish.fridge).toBe(1) // day 1 only, fish keeps 2 days
    expect(fish.freezer).toBe(3)
  })

  it('cooks potatoes and roasted vegetables again mid-week instead of freezing them', () => {
    const data = seed()
    const potato = cookingPlan(data).find((r) => r.dish.code === 'Р14')!
    expect(potato.portions.he.days).toEqual([1, 2, 3, 4])
    expect(potato.totals[0].amount).toBe(150 + 350 + 150 + 200 + 150 + 150 + 150)

    const mid = midweekPlan(data)
    expect(mid.map((m) => m.day)).toEqual([3, 4])
    const veg = mid[0].rows.find((r) => r.dish.code === 'Р11')!
    expect(veg.portions.she.days).toEqual([5, 6, 7])
    const freshPotato = mid[1].rows.find((r) => r.dish.code === 'Р14')!
    expect(freshPotato.portions.he.days).toEqual([5, 6, 7])
    expect(freshPotato.portions.she.days).toEqual([5, 7])
  })

  it('reminds to move freezer portions to the fridge the evening before', () => {
    const data = seed()
    expect(eveningTransfers(data, 0)).toEqual([])
    expect(eveningTransfers(data, 2).map((p) => p.dish.code)).toContain('Р3')
    expect(eveningTransfers(data, 6)).toEqual([])
  })

  it('counts containers without eggs kept in their shells', () => {
    const data = seed()
    const all = containerPlan(data).reduce((n, d) => n + d.boxes.length, 0)
    expect(containerCount(data)).toBeLessThan(all)
  })

  it('lays out containers per day', () => {
    const days = containerPlan(seed())
    expect(days).toHaveLength(7)
    expect(days[0].boxes.find((b) => b.person === 'he' && b.meal === 'Обед')!.portions.map((p) => p.dish.code)).toEqual(['Р3', 'Р14'])
  })
})

describe('timeline', () => {
  const s = schedule(cookingPlan(seed()))

  it('places every dish once without overloading the stove or oven', () => {
    expect(s.placed).toHaveLength(cookingPlan(seed()).length)
    for (const where of ['stove', 'oven'] as const) {
      const xs = s.placed.filter((p) => p.spec.where === where)
      for (const p of xs) {
        // dishes on the heat at the moment this one starts
        const busy = xs.filter((q) => q.start <= p.start && p.start < q.end).length
        expect(busy).toBeLessThanOrEqual(where === 'stove' ? 4 : 2)
      }
    }
  })

  it('never puts dishes with very different temperatures in the oven together', () => {
    const oven = s.placed.filter((p) => p.spec.where === 'oven')
    for (const a of oven)
      for (const b of oven)
        if (a !== b && a.start < b.end && b.start < a.end) expect(Math.abs(a.spec.temp! - b.spec.temp!)).toBeLessThanOrEqual(20)
  })

  it('preheats the oven and fits in about three hours, like the sheet', () => {
    expect(s.preheat).toBeDefined()
    expect(s.total).toBeGreaterThan(120)
    expect(s.total).toBeLessThanOrEqual(200)
  })
})

describe('migration', () => {
  it('upgrades data saved by version 1', () => {
    const old = seed() as unknown as Record<string, unknown>
    old.version = 1
    delete old.prices
    for (const d of old.dishes as { cook?: unknown }[]) delete d.cook
    const data = migrate(old)
    expect(data.version).toBe(2)
    expect(data.prices).toEqual({})
    expect(data.dishes.find((d) => d.code === 'Р3')!.cook).toMatchObject({ where: 'oven', temp: 200 })
  })
})
