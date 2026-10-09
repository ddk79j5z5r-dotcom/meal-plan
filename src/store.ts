import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { COOK_SPECS, createSeed } from './data/seed'
import type { AppData } from './domain/types'

interface Store {
  data: AppData
  /** Apply a mutation to a deep copy of the data. */
  update: (recipe: (draft: AppData) => void) => void
  toggle: (key: string) => void
  replace: (data: AppData) => void
  reset: () => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      data: createSeed(),
      update: (recipe) =>
        set((s) => {
          const draft = structuredClone(s.data)
          recipe(draft)
          return { data: draft }
        }),
      toggle: (key) =>
        set((s) => {
          const checks = { ...s.data.checks }
          if (checks[key]) delete checks[key]
          else checks[key] = true
          return { data: { ...s.data, checks } }
        }),
      replace: (data) => set({ data }),
      reset: () => set({ data: createSeed() }),
    }),
    { name: 'meal-plan', version: 5, partialize: (s) => ({ data: s.data }), migrate: (state) => ({ data: migrate((state as { data: unknown }).data) }) },
  ),
)

export const useData = () => useStore((s) => s.data)

/** Bring data saved by an older version (localStorage or an exported file) up to date. */
export function migrate(raw: unknown): AppData {
  const d = structuredClone(raw) as Omit<AppData, 'version'> & { version: number }
  if (d.version < 2) {
    d.prices = {}
    for (const dish of d.dishes) if (!dish.cook && dish.code && COOK_SPECS[dish.code]) dish.cook = structuredClone(COOK_SPECS[dish.code])
    d.version = 2
  }
  if (d.version < 3) {
    // October 2026 workbook: her menu is new, recipes Р18–Р20 were renumbered to Р21–Р23.
    const fresh = createSeed()
    const renamed: Record<string, string> = { r18: 'r21', r19: 'r22', r20: 'r23' }
    for (const p of fresh.products) if (!d.products.some((x) => x.id === p.id)) d.products.push(p)
    d.dishes = [...fresh.dishes, ...d.dishes.filter((x) => x.custom)]
    for (const day of d.menu.he) for (const meal of day) for (const item of meal.items) if (item.dishId && renamed[item.dishId]) item.dishId = renamed[item.dishId]
    d.menu.she = fresh.menu.she.map((day) => day.map((meal) => ({ ...meal, items: meal.items.map((it) => ({ ...it, id: uid() })) })))
    const she = d.settings.people.she
    if (she.kcal === 1550 && she.protein === 88) Object.assign(she, { kcal: 1500, protein: 100 })
    d.cookSteps = fresh.cookSteps
    d.cookTail = fresh.cookTail
    d.version = 3
  }
  if (d.version < 4) {
    // Recipes rewritten for the air fryer (no oven): built-in dishes get the new texts and cooking parameters.
    const fresh = createSeed()
    const custom = d.dishes.filter((x) => x.custom)
    for (const x of custom) if (x.cook && (x.cook.where as string) === 'oven') x.cook = { ...x.cook, where: 'airfryer', batchSize: x.cook.batchSize ?? 3 }
    d.dishes = [...fresh.dishes, ...custom]
    d.cookSteps = fresh.cookSteps
    d.cookTail = fresh.cookTail
    const foil = d.cookware.find((c) => c.id === 'foil')
    const freshFoil = fresh.cookware.find((c) => c.id === 'foil')
    if (foil && freshFoil) foil.name = freshFoil.name
    d.version = 4
  }
  if (d.version < 5) {
    // Oatmeal (Р1) joins the cooking plan: oats and nuts portioned on Sunday, soaked the evening before.
    const r1 = createSeed().dishes.find((x) => x.id === 'r1')!
    const i = d.dishes.findIndex((x) => x.id === 'r1')
    if (i >= 0) d.dishes[i] = r1
    else d.dishes.unshift(r1)
    d.version = 5
  }
  return d as AppData
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData
  return !!d && (d.version as number) >= 1 && Array.isArray(d.products) && Array.isArray(d.dishes) && !!d.menu?.he && !!d.menu?.she && !!d.settings
}

export const uid = () => Math.random().toString(36).slice(2, 10)
