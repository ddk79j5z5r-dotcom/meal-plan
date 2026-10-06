export type PersonId = 'he' | 'she'
export const PEOPLE: PersonId[] = ['he', 'she']

/** Base unit used in recipes and menu: grams, millilitres or pieces. */
export type Unit = 'g' | 'ml' | 'pcs'

export const CATEGORIES = [
  'Мясо и рыба',
  'Молочное и яйца',
  'Хлеб',
  'Овощи и фрукты',
  'Бакалея',
  'Масла и специи',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Nutrition {
  kcal: number
  p: number
  f: number
  c: number
}

export interface Product {
  id: string
  name: string
  category: Category
  unit: Unit
  /** Label for one base unit when unit is 'pcs' (шт, ломоть, банка). */
  pieceLabel?: string
  /** Weight of one piece in grams, for nutrition of 'pcs' products. */
  pieceWeight?: number
  /** Unit the product is bought and priced in (кг, л, шт, буханка). */
  buyUnit: string
  /** How many base units make one buy unit (1000 g per кг, 12 slices per loaf). */
  buyFactor: number
  /** Purchases are rounded up to a multiple of this, in base units. */
  packStep: number
  /** Price per buy unit, ₽. */
  price: number
  /** Nutrition per 100 g (or 100 ml). */
  per100: Nutrition
  frequency: 'weekly' | 'monthly'
  /** Bought in this fixed amount (base units) every 4-week cycle, regardless of menu. */
  fixedPerCycle?: number
}

export interface Ingredient {
  productId: string
  amount: number
}

export interface Dish {
  id: string
  code?: string
  name: string
  /** Default ingredients for one portion. */
  ingredients: Ingredient[]
  ingredientsText?: string
  howTo: string
  storage: string
  /** Cooked on the weekly cooking day. */
  batch: boolean
  custom?: boolean
}

/** One entry in a meal: either a dish (with its own editable amounts) or a single product. */
export interface MealItem {
  id: string
  dishId: string | null
  ingredients: Ingredient[]
}

export interface Meal {
  name: string
  items: MealItem[]
}

export type DayMenu = Meal[]
export type Menu = Record<PersonId, DayMenu[]>

export interface Person {
  name: string
  kcal: number
  protein: number
  height?: number
  weight?: number
}

export interface Settings {
  /** ISO date (YYYY-MM-DD) of day 1 — a Sunday, the shopping and cooking day. */
  startDate: string
  people: Record<PersonId, Person>
}

export interface CookwareItem {
  id: string
  name: string
  unit: string
  qty: number
  price: number
}

export interface CookStep {
  n: number
  what: string
  time: string
  note: string
}

export interface AppData {
  version: 1
  products: Product[]
  dishes: Dish[]
  menu: Menu
  settings: Settings
  cookware: CookwareItem[]
  cookSteps: CookStep[]
  cookTail: string
  /** Checkbox state keyed by `bought:…`, `eaten:…`, `step:…`, `cw:…`. */
  checks: Record<string, boolean>
  /** Manual leftover overrides in base units, keyed by period key + product id. */
  leftovers: Record<string, number>
}
