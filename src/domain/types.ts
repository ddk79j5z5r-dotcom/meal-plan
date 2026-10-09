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
  'Сладкое',
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

/** How a batch dish is cooked on the cooking day and how long it keeps. */
export interface CookSpec {
  /** The air fryer has one basket and cooks in batches; the stove runs in parallel. */
  where: 'airfryer' | 'stove'
  /** Air fryer temperature, °C. */
  temp?: number
  /** Time on the stove, or per batch in the air fryer, minutes. */
  minutes: number
  /** Air fryer: portions that fit in one batch. */
  batchSize?: number
  /** What to do while it cooks: turn over, shake, raise the temperature. */
  heatNote?: string
  /** Hands-on preparation before it goes on the heat, minutes. */
  prep: number
  /** The cook must stay at the stove the whole time (e.g. frying mince). */
  attended?: boolean
  /** What to do during preparation. */
  prepText: string
  /** Last menu day (1 = cooking day) the dish can be kept in the fridge. */
  fridgeDays: number
  /** Portions beyond `fridgeDays` go to the freezer; otherwise they are cooked fresh mid-week. */
  freezes: boolean
  /** From this menu day on, cook it fresh mid-week even though it freezes (fish for days 5–7). */
  freshFrom?: number
  /** Reminder for the evening before the cooking day. */
  thaw?: string
  /** Kept as is, without a food container (eggs in their shells). */
  loose?: boolean
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
  cook?: CookSpec
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
  version: 4
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
  /**
   * Price changes: product id → { week number → price per buy unit }.
   * A price applies from its week onwards until the next change; before the first one, `Product.price` applies.
   */
  prices: Record<string, Record<string, number>>
}
