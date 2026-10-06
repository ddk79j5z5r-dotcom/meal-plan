import { formatAmount, nutritionOf, productMap } from '../domain/plan'
import type { Dish, Ingredient, MealItem, Product } from '../domain/types'
import { useData } from '../store'
import { Macros, Sheet } from './common'

/** Display name of a menu item: its dish, or its single product. */
export function itemName(item: MealItem, dishes: Dish[], products: Map<string, Product>): string {
  if (item.dishId) return dishes.find((d) => d.id === item.dishId)?.name ?? 'Блюдо'
  return products.get(item.ingredients[0]?.productId)?.name ?? 'Продукт'
}

/** Short composition line, skipping oils and spices; just the amount for a single product. */
export function itemDetails(ingredients: Ingredient[], products: Map<string, Product>, isDish = true): string {
  if (!isDish && ingredients.length === 1) return formatAmount(products.get(ingredients[0].productId), ingredients[0].amount)
  return ingredients
    .map((i) => ({ i, p: products.get(i.productId) }))
    .filter(({ p }) => p && p.category !== 'Масла и специи')
    .map(({ i, p }) => `${shortName(p!)} ${formatAmount(p, i.amount)}`)
    .join(', ')
}

export const shortName = (p: Product) => p.name.replace(/\s*\(.*\)$/, '').replace(/,\s*\d+\s*г$/, '')

export function DishSheet({ dish, ingredients, onClose }: { dish: Dish; ingredients?: Ingredient[]; onClose: () => void }) {
  const data = useData()
  const products = productMap(data.products)
  const list = ingredients ?? dish.ingredients
  const n = nutritionOf(list, products)
  return (
    <Sheet
      title={
        <>
          {dish.code && <span className="code">{dish.code}</span>} {dish.name}
        </>
      }
      onClose={onClose}
    >
      {list.length > 0 && (
        <>
          <h3>{ingredients ? 'В этом приёме' : 'На 1 порцию'}</h3>
          <ul className="ing-list">
            {list.map((i) => {
              const p = products.get(i.productId)
              return (
                <li key={i.productId}>
                  <span>{p?.name ?? i.productId}</span>
                  <b>{formatAmount(p, i.amount)}</b>
                </li>
              )
            })}
          </ul>
          <p className="macros">
            <Macros n={n} />
          </p>
        </>
      )}
      {dish.ingredientsText && (
        <>
          <h3>Ингредиенты по рецепту</h3>
          <p>{dish.ingredientsText}</p>
        </>
      )}
      {dish.howTo && (
        <>
          <h3>Приготовление</h3>
          <p className="prose">{dish.howTo}</p>
        </>
      )}
      {dish.storage && (
        <>
          <h3>Хранение</h3>
          <p className="prose">{dish.storage}</p>
        </>
      )}
      {dish.batch && <p className="tag">Готовится в воскресенье на неделю</p>}
    </Sheet>
  )
}
