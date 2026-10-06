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
    { name: 'meal-plan', version: 2, partialize: (s) => ({ data: s.data }), migrate: (state) => ({ data: migrate((state as { data: unknown }).data) }) },
  ),
)

export const useData = () => useStore((s) => s.data)

/** Bring data saved by an older version (localStorage or an exported file) up to date. */
export function migrate(raw: unknown): AppData {
  const d = structuredClone(raw) as AppData & { version: number }
  if (d.version < 2) {
    d.prices = {}
    for (const dish of d.dishes) if (!dish.cook && dish.code && COOK_SPECS[dish.code]) dish.cook = structuredClone(COOK_SPECS[dish.code])
    d.version = 2
  }
  return d
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData
  return !!d && (d.version as number) >= 1 && Array.isArray(d.products) && Array.isArray(d.dishes) && !!d.menu?.he && !!d.menu?.she && !!d.settings
}

export const uid = () => Math.random().toString(36).slice(2, 10)
