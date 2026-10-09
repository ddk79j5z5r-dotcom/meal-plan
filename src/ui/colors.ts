import type { CSSProperties } from 'react'
import type { Category } from '../domain/types'

/** CSS custom property `--c` drives the accent of a card, list or header. */
export const tint = (color: string) => ({ '--c': color }) as CSSProperties

const MEALS: [RegExp, string, string][] = [
  [/^завтрак/i, 'var(--breakfast)', '🌅'],
  [/^перекус/i, 'var(--snack)', '🍎'],
  [/^обед/i, 'var(--lunch)', '🍲'],
  [/^ужин/i, 'var(--dinner)', '🌙'],
]

export function mealStyle(name: string): { color: string; icon: string } {
  const hit = MEALS.find(([re]) => re.test(name.trim()))
  return hit ? { color: hit[1], icon: hit[2] } : { color: 'var(--muted)', icon: '🍴' }
}

export const CATEGORY_COLOR: Record<Category, string> = {
  'Мясо и рыба': 'var(--cat-meat)',
  'Молочное и яйца': 'var(--cat-dairy)',
  Хлеб: 'var(--cat-bread)',
  'Овощи и фрукты': 'var(--cat-veg)',
  Бакалея: 'var(--cat-grocery)',
  Сладкое: 'var(--cat-sweet)',
  'Масла и специи': 'var(--cat-oil)',
}

export const CATEGORY_ICON: Record<Category, string> = {
  'Мясо и рыба': '🥩',
  'Молочное и яйца': '🥛',
  Хлеб: '🍞',
  'Овощи и фрукты': '🥦',
  Бакалея: '🌾',
  Сладкое: '🍫',
  'Масла и специи': '🧂',
}
