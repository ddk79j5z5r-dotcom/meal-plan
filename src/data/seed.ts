import type { AppData, Dish, Ingredient, Meal, MealItem, Product } from '../domain/types'
import { defaultStartDate } from '../domain/calendar'
import sheet from './sheet.json'

// Products, prices and pack steps come from the «Закупка» sheets of the original workbook.
// Nutrition is per 100 g / 100 ml from standard reference tables.
const kg = { unit: 'g', buyUnit: 'кг', buyFactor: 1000, packStep: 100 } as const

export const PRODUCTS: Product[] = [
  { id: 'chicken_fillet', name: 'Куриное филе', category: 'Мясо и рыба', ...kg, price: 480, per100: { kcal: 113, p: 23.6, f: 1.9, c: 0.4 }, frequency: 'weekly' },
  { id: 'chicken_thigh', name: 'Куриное бедро (без кожи)', category: 'Мясо и рыба', ...kg, price: 340, per100: { kcal: 125, p: 19.6, f: 4.9, c: 0 }, frequency: 'weekly' },
  { id: 'beef_mince', name: 'Говяжий фарш', category: 'Мясо и рыба', ...kg, price: 700, per100: { kcal: 215, p: 18.6, f: 15.6, c: 0 }, frequency: 'weekly' },
  { id: 'beef', name: 'Говядина куском (лопатка/мякоть)', category: 'Мясо и рыба', ...kg, price: 850, per100: { kcal: 158, p: 19.5, f: 9, c: 0 }, frequency: 'weekly' },
  { id: 'fish', name: 'Рыба (минтай/горбуша)', category: 'Мясо и рыба', ...kg, price: 480, per100: { kcal: 105, p: 18, f: 3.5, c: 0 }, frequency: 'weekly' },
  { id: 'tuna', name: 'Тунец консерв. в собств. соку, 185 г', category: 'Мясо и рыба', unit: 'pcs', pieceLabel: 'банка', pieceWeight: 140, buyUnit: 'банка', buyFactor: 1, packStep: 1, price: 210, per100: { kcal: 103, p: 23, f: 1, c: 0 }, frequency: 'weekly' },
  { id: 'eggs', name: 'Яйца С1', category: 'Молочное и яйца', unit: 'pcs', pieceLabel: 'шт', pieceWeight: 55, buyUnit: 'шт', buyFactor: 1, packStep: 10, price: 13, per100: { kcal: 157, p: 12.7, f: 11.5, c: 0.7 }, frequency: 'weekly' },
  { id: 'cottage', name: 'Творог 5%', category: 'Молочное и яйца', ...kg, packStep: 200, price: 575, per100: { kcal: 121, p: 17.2, f: 5, c: 1.8 }, frequency: 'weekly' },
  { id: 'milk', name: 'Молоко 2,5%', category: 'Молочное и яйца', unit: 'ml', buyUnit: 'л', buyFactor: 1000, packStep: 1000, price: 105, per100: { kcal: 52, p: 2.8, f: 2.5, c: 4.7 }, frequency: 'weekly' },
  { id: 'syrok', name: 'Творожный сырок Б.Ю. Александров', category: 'Молочное и яйца', unit: 'pcs', pieceLabel: 'шт', pieceWeight: 40, buyUnit: 'шт', buyFactor: 1, packStep: 1, price: 65, per100: { kcal: 400, p: 8, f: 25, c: 34 }, frequency: 'weekly' },
  { id: 'cheese', name: 'Сыр твёрдый', category: 'Молочное и яйца', ...kg, price: 950, per100: { kcal: 350, p: 25, f: 27, c: 0 }, frequency: 'weekly' },
  { id: 'bread', name: 'Хлеб цельнозерновой (≈12 ломтей)', category: 'Хлеб', unit: 'pcs', pieceLabel: 'ломт.', pieceWeight: 30, buyUnit: 'буханка', buyFactor: 12, packStep: 12, price: 95, per100: { kcal: 245, p: 9, f: 3, c: 43 }, frequency: 'weekly' },
  { id: 'potato', name: 'Картофель', category: 'Овощи и фрукты', ...kg, price: 55, per100: { kcal: 77, p: 2, f: 0.4, c: 16.3 }, frequency: 'weekly' },
  { id: 'cucumber', name: 'Огурцы', category: 'Овощи и фрукты', ...kg, price: 170, per100: { kcal: 15, p: 0.8, f: 0.1, c: 2.8 }, frequency: 'weekly' },
  { id: 'tomato', name: 'Помидоры', category: 'Овощи и фрукты', ...kg, price: 250, per100: { kcal: 20, p: 1.1, f: 0.2, c: 3.8 }, frequency: 'weekly' },
  { id: 'zucchini', name: 'Кабачок', category: 'Овощи и фрукты', ...kg, price: 150, per100: { kcal: 24, p: 0.6, f: 0.3, c: 4.6 }, frequency: 'weekly' },
  { id: 'carrot', name: 'Морковь', category: 'Овощи и фрукты', ...kg, price: 55, per100: { kcal: 35, p: 1.3, f: 0.1, c: 6.9 }, frequency: 'weekly' },
  { id: 'onion', name: 'Лук репчатый', category: 'Овощи и фрукты', ...kg, price: 45, per100: { kcal: 41, p: 1.4, f: 0, c: 8.2 }, frequency: 'weekly' },
  { id: 'pepper', name: 'Перец болгарский', category: 'Овощи и фрукты', ...kg, price: 350, per100: { kcal: 26, p: 1.3, f: 0.1, c: 5.3 }, frequency: 'weekly' },
  { id: 'broccoli', name: 'Брокколи (замороженная)', category: 'Овощи и фрукты', ...kg, price: 330, per100: { kcal: 28, p: 3, f: 0.4, c: 5.2 }, frequency: 'weekly' },
  { id: 'banana', name: 'Бананы', category: 'Овощи и фрукты', ...kg, price: 135, per100: { kcal: 95, p: 1.5, f: 0.2, c: 21.8 }, frequency: 'weekly' },
  { id: 'apple', name: 'Яблоки', category: 'Овощи и фрукты', ...kg, price: 150, per100: { kcal: 47, p: 0.4, f: 0.4, c: 9.8 }, frequency: 'weekly' },
  { id: 'berries', name: 'Ягоды замороженные', category: 'Овощи и фрукты', ...kg, price: 450, per100: { kcal: 40, p: 0.8, f: 0.4, c: 8 }, frequency: 'weekly' },
  { id: 'rice', name: 'Рис', category: 'Бакалея', ...kg, packStep: 1000, price: 140, per100: { kcal: 344, p: 6.7, f: 0.7, c: 78.9 }, frequency: 'monthly' },
  { id: 'oats', name: 'Овсяные хлопья', category: 'Бакалея', ...kg, packStep: 500, price: 110, per100: { kcal: 352, p: 12.3, f: 6.1, c: 59.5 }, frequency: 'monthly' },
  { id: 'nuts', name: 'Орехи (грецкие/миндаль)', category: 'Бакалея', ...kg, price: 1500, per100: { kcal: 630, p: 18, f: 56, c: 13 }, frequency: 'monthly' },
  { id: 'honey', name: 'Мёд', category: 'Бакалея', ...kg, packStep: 300, price: 700, per100: { kcal: 328, p: 0.8, f: 0, c: 81.5 }, frequency: 'monthly' },
  { id: 'peanut', name: 'Арахисовая паста', category: 'Бакалея', ...kg, packStep: 300, price: 600, per100: { kcal: 590, p: 25, f: 50, c: 20 }, frequency: 'monthly' },
  { id: 'oil_sun', name: 'Масло подсолнечное (жарка, запекание)', category: 'Масла и специи', unit: 'ml', buyUnit: 'л', buyFactor: 1000, packStep: 500, price: 160, per100: { kcal: 830, p: 0, f: 92, c: 0 }, frequency: 'monthly', fixedPerCycle: 1000 },
  { id: 'oil_olive', name: 'Масло оливковое (салаты)', category: 'Масла и специи', unit: 'ml', buyUnit: 'л', buyFactor: 1000, packStep: 500, price: 450, per100: { kcal: 830, p: 0, f: 92, c: 0 }, frequency: 'monthly', fixedPerCycle: 500 },
  { id: 'spices', name: 'Специи: соль, перец, паприка, чеснок гран., лавр. лист', category: 'Масла и специи', unit: 'pcs', pieceLabel: 'набор', buyUnit: 'набор', buyFactor: 1, packStep: 1, price: 450, per100: { kcal: 0, p: 0, f: 0, c: 0 }, frequency: 'monthly', fixedPerCycle: 1 },
]

const recipes = sheet.recipes as Record<string, { code: string; title: string; ingredients: string; howTo: string; storage: string }>

const ing = (productId: string, amount: number): Ingredient => ({ productId, amount })

function dish(code: string, ingredients: Ingredient[], batch: boolean): Dish {
  const r = recipes[code]
  return {
    id: code.toLowerCase().replace('р', 'r'),
    code,
    name: r.title.replace(/\s*\((ему|ей|ему и ей)\)\s*$/, ''),
    ingredients,
    ingredientsText: r.ingredients,
    howTo: r.howTo,
    storage: r.storage,
    batch,
  }
}

// Per-portion amounts are calibrated so the weekly totals match the original «Закупка нед.1» sheet.
export const DISHES: Dish[] = [
  dish('Р1', [ing('oats', 80), ing('milk', 250), ing('banana', 120), ing('nuts', 20), ing('honey', 10)], false),
  dish('Р2', [ing('eggs', 2)], true),
  dish('Р3', [ing('chicken_fillet', 200), ing('oil_sun', 3)], true),
  dish('Р4', [ing('chicken_thigh', 200)], true),
  dish('Р5', [ing('beef', 200), ing('onion', 50), ing('carrot', 50), ing('oil_sun', 5)], true),
  dish('Р6', [ing('beef_mince', 150), ing('onion', 30), ing('oil_sun', 5)], true),
  dish('Р7', [ing('beef', 150)], true),
  dish('Р8', [ing('fish', 150), ing('oil_sun', 3)], true),
  { ...dish('Р9', [ing('tuna', 1), ing('oil_olive', 3)], false), name: 'Тунец консервированный' },
  dish('Р10', [ing('zucchini', 100), ing('carrot', 50), ing('onion', 50), ing('oil_sun', 3)], true),
  dish('Р11', [ing('zucchini', 75), ing('pepper', 75), ing('oil_sun', 3)], true),
  dish('Р12', [ing('cucumber', 100), ing('tomato', 100), ing('oil_olive', 3)], false),
  dish('Р13', [ing('rice', 80)], true),
  dish('Р14', [ing('potato', 150)], true),
  dish('Р15', [ing('cottage', 200), ing('eggs', 1), ing('oats', 30), ing('berries', 100)], true),
  dish('Р16', [ing('broccoli', 150)], false),
  dish('Р17', [], false),
  dish('Р18', [ing('cottage', 200), ing('eggs', 2), ing('oats', 40), ing('banana', 120), ing('honey', 10)], false),
  dish('Р19', [ing('chicken_fillet', 200), ing('potato', 150), ing('carrot', 50), ing('onion', 50), ing('eggs', 1)], true),
  dish('Р20', [ing('beef', 200), ing('potato', 200), ing('onion', 50), ing('oil_sun', 5)], true),
]

let seq = 0
const nextId = () => `i${++seq}`

/** Menu item from a dish, optionally overriding amounts (`{ rice: 70 }`) or dropping ingredients (`{ nuts: 0 }`). */
function d(dishId: string, overrides: Record<string, number> = {}): MealItem {
  const base = DISHES.find((x) => x.id === dishId)
  if (!base) throw new Error(`unknown dish ${dishId}`)
  const ingredients = base.ingredients
    .map((i) => (i.productId in overrides ? { ...i, amount: overrides[i.productId] } : { ...i }))
    .filter((i) => i.amount > 0)
  return { id: nextId(), dishId, ingredients }
}

/** Menu item for a single product. */
function p(productId: string, amount: number): MealItem {
  return { id: nextId(), dishId: null, ingredients: [ing(productId, amount)] }
}

const meals = (names: string[], items: MealItem[][]): Meal[] => names.map((name, i) => ({ name, items: items[i] }))
const HE_MEALS = ['Завтрак', 'Перекус', 'Обед', 'Перекус', 'Ужин']
const SHE_MEALS = ['Завтрак', 'Обед', 'Перекус', 'Ужин']

function buildMenu() {
  seq = 0
  const he = [
    meals(HE_MEALS, [[d('r1')], [p('cottage', 200), p('apple', 150)], [d('r3'), d('r14'), d('r12')], [d('r2'), p('bread', 2)], [d('r6'), d('r13'), d('r10')]]),
    meals(HE_MEALS, [[d('r2', { eggs: 3 }), p('cheese', 50), p('bread', 2)], [p('banana', 120), p('nuts', 20)], [d('r9'), d('r14', { potato: 200 }), d('r12')], [p('cottage', 200), p('honey', 10)], [d('r4'), d('r14'), d('r10')]]),
    meals(HE_MEALS, [[d('r15')], [d('r2'), p('milk', 200)], [d('r5'), d('r14'), d('r10')], [p('apple', 150), p('peanut', 20)], [d('r3'), d('r13'), d('r12')]]),
    meals(HE_MEALS, [[d('r1', { nuts: 0 })], [p('cottage', 200), p('nuts', 15)], [d('r9'), d('r14', { potato: 200 }), d('r10')], [d('r2'), p('bread', 2)], [d('r3'), d('r13', { rice: 100 }), d('r16')]]),
    meals(HE_MEALS, [[d('r2', { eggs: 3 }), d('r12'), p('bread', 1)], [p('banana', 120), p('nuts', 20)], [d('r6', { beef_mince: 200 }), d('r14'), d('r12')], [p('cottage', 200), p('berries', 100)], [d('r3'), d('r13'), d('r10')]]),
    meals(HE_MEALS, [[d('r15')], [d('r2'), p('bread', 1)], [d('r9'), d('r13', { rice: 100 }), d('r10')], [p('banana', 120), p('peanut', 20)], [d('r3'), d('r14', { potato: 200 }), d('r12')]]),
    meals(HE_MEALS, [[d('r1', { honey: 0 })], [p('cottage', 200)], [d('r5'), d('r14'), d('r10')], [d('r2'), p('bread', 1)], [d('r9'), d('r13'), d('r16')]]),
  ]
  const syrok = () => [p('syrok', 2)]
  const f150 = { chicken_fillet: 150 }
  const t150 = { chicken_thigh: 150 }
  const r70 = { rice: 70 }
  const she = [
    meals(SHE_MEALS, [syrok(), [d('r3', f150), d('r13', r70), d('r12')], [p('cottage', 150), p('apple', 75)], [d('r8'), d('r11')]]),
    meals(SHE_MEALS, [syrok(), [d('r7'), d('r14'), d('r12')], [d('r2')], [d('r4', t150), d('r13', r70), d('r12')]]),
    meals(SHE_MEALS, [syrok(), [d('r8'), d('r14'), d('r12')], [p('cottage', 150), p('berries', 100)], [d('r3', f150), d('r11')]]),
    meals(SHE_MEALS, [syrok(), [d('r7'), d('r13', r70), d('r12')], [p('apple', 150), p('nuts', 15)], [d('r3', f150), d('r14'), d('r12')]]),
    meals(SHE_MEALS, [syrok(), [d('r4', t150), d('r14'), d('r11')], [d('r2')], [d('r8'), d('r13', r70), d('r12')]]),
    meals(SHE_MEALS, [syrok(), [d('r7'), d('r11')], [p('cottage', 150)], [d('r3', f150), d('r13', r70), d('r12')]]),
    meals(SHE_MEALS, [syrok(), [d('r8'), d('r13', r70), d('r12')], [p('apple', 150), p('nuts', 15)], [d('r4', t150), d('r14'), d('r11')]]),
  ]
  return { he, she }
}

export function createSeed(today = new Date()): AppData {
  return {
    version: 1,
    products: structuredClone(PRODUCTS),
    dishes: structuredClone(DISHES),
    menu: buildMenu(),
    settings: {
      startDate: defaultStartDate(today),
      people: {
        he: { name: 'Он', kcal: 2400, protein: 145 },
        she: { name: 'Она', kcal: 1550, protein: 88 },
      },
    },
    cookware: [
      { id: 'containers', name: 'Контейнеры для еды 0,6–0,8 л (с крышкой, под микроволновку)', unit: 'шт', qty: 12, price: 110 },
      { id: 'zip', name: 'Пакеты для заморозки zip', unit: 'уп', qty: 2, price: 150 },
      { id: 'foil', name: 'Фольга / пергамент для запекания', unit: 'уп', qty: 2, price: 130 },
    ],
    cookSteps: sheet.steps,
    cookTail: sheet.tail,
    checks: {},
    leftovers: {},
  }
}
