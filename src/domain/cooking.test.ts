import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { migrate } from '../store'
import type { AppData } from './types'
import { batchTimes, containerCount, containerPlan, cookingPlan, dailyPlan, eveningTransfers, midweekPlan, schedule, thawFor } from './cooking'

const seed = () => createSeed(new Date(2026, 9, 6))

describe('cooking day plan', () => {
  it('matches the «План готовки» sheet for dishes that keep', () => {
    const plan = cookingPlan(seed())
    const row = (code: string) => plan.find((r) => r.dish.code === code)!
    expect(row('Р3').portions.he.count).toBe(5)
    expect(row('Р3').portions.she.count).toBe(4)
    expect(row('Р3').totals.find((t) => t.productId === 'chicken_fillet')!.amount).toBe(1680)
    expect(row('Р2').totals).toEqual([{ productId: 'eggs', amount: 16 }])
    expect(row('Р18').portions.she.days).toEqual([1, 4, 6])
    expect(row('Р19').portions.she.days).toEqual([2, 4, 6])
    expect(row('Р18').totals).toEqual([{ productId: 'buckwheat', amount: 240 }])
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
    expect(fish.freezer).toBe(1) // day 3; days 5 and 7 are cooked fresh mid-week
    expect(cookingPlan(seed()).some((r) => r.dish.code === 'Р20')).toBe(false) // the sandwich is assembled daily
  })

  it('cooks potatoes and roasted vegetables again mid-week instead of freezing them', () => {
    const data = seed()
    const potato = cookingPlan(data).find((r) => r.dish.code === 'Р14')!
    expect(potato.portions.he.days).toEqual([1, 2, 3, 4])
    expect(potato.portions.she.days).toEqual([2, 3])
    expect(potato.totals[0].amount).toBe(150 + 350 + 150 + 200 + 250 + 250)

    const mid = midweekPlan(data)
    expect(mid.map((m) => m.day)).toEqual([3, 4])
    const veg = mid[0].rows.find((r) => r.dish.code === 'Р11')!
    expect(veg.portions.she.days).toEqual([5, 6, 7])
    expect(mid[1].rows.find((r) => r.dish.code === 'Р8')!.portions.she.days).toEqual([5, 7])
    const freshPotato = mid[1].rows.find((r) => r.dish.code === 'Р14')!
    expect(freshPotato.portions.he.days).toEqual([5, 6, 7])
    expect(freshPotato.portions.she.days).toEqual([5, 7])
  })

  it('reminds to defrost raw fish the evening before cooking it', () => {
    const data = seed()
    expect(thawFor(data, 0).map((r) => r.dish.code)).toEqual(['Р8'])
    expect(thawFor(data, 4).map((r) => r.dish.code)).toEqual(['Р8'])
    expect(thawFor(data, 3)).toEqual([])
  })

  it('reminds to move freezer portions to the fridge the evening before', () => {
    const data = seed()
    expect(eveningTransfers(data, 0)).toEqual([])
    expect(eveningTransfers(data, 2).map((p) => p.dish.code)).toContain('Р3')
    expect(eveningTransfers(data, 6)).toEqual([])
  })

  it('lists dishes made fresh every day, like oatmeal', () => {
    const daily = dailyPlan(seed())
    const oatmeal = daily.find((r) => r.dish.code === 'Р1')!
    expect(oatmeal.portions.he.days).toEqual([1, 4, 7])
    expect(daily.map((r) => r.dish.code)).toEqual(expect.arrayContaining(['Р1', 'Р9', 'Р12', 'Р16', 'Р20']))
    expect(daily.some((r) => r.dish.batch)).toBe(false)
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

  it('places every dish once, at most 4 on the stove and 1 in the air fryer at a time', () => {
    expect(s.placed).toHaveLength(cookingPlan(seed()).length)
    for (const [where, cap] of [['stove', 4], ['airfryer', 1]] as const) {
      const xs = s.placed.filter((p) => p.spec.where === where)
      for (const p of xs) {
        // dishes on the heat at the moment this one starts
        const busy = xs.filter((q) => q.start <= p.start && p.start < q.end).length
        expect(busy).toBeLessThanOrEqual(cap)
      }
    }
  })

  it('splits air fryer dishes into batches like the sheet', () => {
    const batches = (code: string) => s.placed.find((p) => p.row.dish.code === code)!.batches
    expect(batches('Р3')).toBe(3) // 9 portions, 3 per batch
    expect(batches('Р4')).toBe(1)
    expect(batches('Р7')).toBe(1)
    expect(batches('Р8')).toBe(1) // only days 1 and 3 on Sunday; days 5–7 are cooked fresh
    const fillet = s.placed.find((p) => p.row.dish.code === 'Р3')!
    const times = batchTimes(fillet)
    expect(times).toHaveLength(3)
    expect(times[0].start).toBe(fillet.start + 3)
    expect(times[2].end).toBe(fillet.end)
  })

  it('starts with the long beef in the air fryer and takes about four hours, like the sheet', () => {
    expect(s.placed[0].row.dish.code).toBe('Р7')
    expect(s.total).toBeGreaterThan(210)
    expect(s.total).toBeLessThanOrEqual(270)
  })
})

describe('migration', () => {
  it('upgrades data saved by version 1', () => {
    const old = seed() as unknown as Record<string, unknown>
    old.version = 1
    delete old.prices
    for (const d of old.dishes as { cook?: unknown }[]) delete d.cook
    const data = migrate(old)
    expect(data.version).toBe(4)
    expect(data.prices).toEqual({})
    expect(data.dishes.find((d) => d.code === 'Р3')!.cook).toMatchObject({ where: 'airfryer', temp: 180, batchSize: 3 })
  })
})

describe('migration to the October 2026 plan', () => {
  it('replaces her menu, keeps his menu, prices and settings, renumbers extra recipes', () => {
    const old = seed() as unknown as Omit<AppData, 'version'> & { version: number }
    old.version = 2
    // what version 2 had: her old 4-meal menu, extra recipes as Р18–Р20, old targets
    old.menu.she = old.menu.she.map((day) => day.slice(0, 4))
    old.dishes = old.dishes.filter((x) => !['r21', 'r22', 'r23'].includes(x.id))
    old.menu.he[0][0].items.push({ id: 'x', dishId: 'r18', ingredients: [] }) // he had added pancakes (old Р18)
    old.settings.people.she = { name: 'Она', kcal: 1550, protein: 88 }
    old.settings.startDate = '2026-10-04'
    old.prices = { eggs: { 1: 15 } }
    old.products = old.products.filter((p) => !['carbonade', 'bread_black', 'chocopie', 'buckwheat', 'ptitim'].includes(p.id))
    old.products.find((p) => p.id === 'milk')!.price = 99
    old.dishes.push({ id: 'd_mine', name: 'Моё блюдо', ingredients: [], howTo: '', storage: '', batch: false, custom: true })

    const data = migrate(old)
    expect(data.version).toBe(4)
    expect(data.menu.she[0].map((m) => m.name)).toEqual(['Завтрак', 'Перекус 1', 'Обед', 'Перекус 2', 'Ужин'])
    expect(data.menu.he[0][0].items.at(-1)!.dishId).toBe('r21')
    expect(data.dishes.find((x) => x.id === 'r21')!.name).toBe('Творожные панкейки')
    expect(data.dishes.some((x) => x.id === 'd_mine')).toBe(true)
    expect(data.settings.people.she).toMatchObject({ kcal: 1500, protein: 100 })
    expect(data.settings.startDate).toBe('2026-10-04')
    expect(data.prices).toEqual({ eggs: { 1: 15 } })
    expect(data.products.find((p) => p.id === 'milk')!.price).toBe(99)
    expect(data.products.some((p) => p.id === 'chocopie')).toBe(true)
  })
})

describe('migration to the air fryer recipes', () => {
  it('replaces built-in recipes, converts custom oven dishes and keeps the rest', () => {
    const old = seed() as unknown as Omit<AppData, 'version'> & { version: number }
    old.version = 3
    const r3 = old.dishes.find((x) => x.code === 'Р3')!
    r3.name = 'Куриное филе запечённое'
    r3.cook = { where: 'oven' as never, temp: 200, minutes: 25, prep: 10, prepText: '', fridgeDays: 3, freezes: true }
    old.dishes.push({ id: 'd_mine', name: 'Моё', ingredients: [], howTo: '', storage: '', batch: true, custom: true, cook: { where: 'oven' as never, temp: 190, minutes: 20, prep: 5, prepText: '', fridgeDays: 3, freezes: true } })
    old.cookware.find((c) => c.id === 'foil')!.name = 'Фольга / пергамент для запекания'
    old.prices = { fish: { 0: 500 } }

    const data = migrate(old)
    expect(data.version).toBe(4)
    expect(data.dishes.find((x) => x.code === 'Р3')).toMatchObject({ name: 'Куриное филе в аэрогриле', cook: { where: 'airfryer' } })
    expect(data.dishes.find((x) => x.id === 'd_mine')!.cook).toMatchObject({ where: 'airfryer', temp: 190, batchSize: 3 })
    expect(data.cookware.find((c) => c.id === 'foil')!.name).toContain('аэрогриля')
    expect(data.prices).toEqual({ fish: { 0: 500 } })
  })
})
