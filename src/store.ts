import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSeed } from './data/seed'
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
    { name: 'meal-plan', version: 1, partialize: (s) => ({ data: s.data }) },
  ),
)

export const useData = () => useStore((s) => s.data)

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData
  return !!d && d.version === 1 && Array.isArray(d.products) && Array.isArray(d.dishes) && !!d.menu?.he && !!d.menu?.she && !!d.settings
}

export const uid = () => Math.random().toString(36).slice(2, 10)
