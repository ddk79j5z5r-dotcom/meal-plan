import { useState } from 'react'
import { addDays, formatLong, planDay, toISO } from '../domain/calendar'
import { addN, formatInt, nutritionOf, productMap, ZERO } from '../domain/plan'
import type { Dish, MealItem, PersonId } from '../domain/types'
import { useData, useStore } from '../store'
import { Bar, Check, PersonToggle } from './common'
import { DishSheet, itemDetails, itemName } from './DishSheet'
import type { Tab } from '../App'

export function Today({ person, setPerson, go }: { person: PersonId; setPerson: (p: PersonId) => void; go: (t: Tab) => void }) {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
  const today = toISO(new Date())
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState<{ dish: Dish; item: MealItem } | null>(null)

  const products = productMap(data.products)
  const { startDate, people } = data.settings
  const pd = planDay(startDate, date)
  const target = people[person]
  const day = data.menu[person][pd.menuDay] ?? []
  const eatenKey = (i: number) => `eaten:${date}:${person}:${i}`

  const mealN = day.map((m) => nutritionOf(m.items.flatMap((i) => i.ingredients), products))
  const planned = mealN.reduce(addN, ZERO)
  const eaten = mealN.reduce((acc, n, i) => (data.checks[eatenKey(i)] ? addN(acc, n) : acc), ZERO)

  return (
    <div className="page">
      <div className="picker">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Предыдущий день">
          ‹
        </button>
        <div className="picker-mid">
          <b className="cap">{formatLong(date)}</b>
          {pd.offset >= 0 ? (
            <span className="muted">
              День {pd.cycleDay + 1} из 28 · неделя {pd.weekInCycle + 1} · меню дня {pd.menuDay + 1}
            </span>
          ) : (
            <span className="muted">До старта плана {-pd.offset} дн.</span>
          )}
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Следующий день">
          ›
        </button>
      </div>
      {date !== today && (
        <button className="link center" onClick={() => setDate(today)}>
          Вернуться к сегодня
        </button>
      )}

      {pd.offset >= 0 && pd.menuDay === 0 && (
        <div className="banner">
          <b>🛒 День закупки и готовки</b>
          <div className="row">
            <button className="btn small" onClick={() => go('shop')}>
              Список покупок
            </button>
            <button className="btn small" onClick={() => go('cook')}>
              План готовки
            </button>
          </div>
        </div>
      )}

      <PersonToggle value={person} onChange={setPerson} />

      <div className="card">
        <Bar label="Калории" value={eaten.kcal} target={target.kcal} unit="ккал" />
        <Bar label="Белок" value={eaten.p} target={target.protein} unit="г" />
        <p className="muted small">
          По меню за день: {formatInt(planned.kcal)} ккал · Б {formatInt(planned.p)} · Ж {formatInt(planned.f)} · У {formatInt(planned.c)}
        </p>
      </div>

      {day.map((meal, mi) => {
        const done = !!data.checks[eatenKey(mi)]
        return (
          <section key={mi} className={`card meal ${done ? 'done' : ''}`}>
            <header className="meal-head">
              <Check checked={done} onChange={() => toggle(eatenKey(mi))} label={`${meal.name}: съедено`} />
              <h3>{meal.name}</h3>
              <span className="muted small">
                {formatInt(mealN[mi].kcal)} ккал · Б {formatInt(mealN[mi].p)}
              </span>
            </header>
            <ul className="items">
              {meal.items.map((item) => {
                const dish = item.dishId ? data.dishes.find((d) => d.id === item.dishId) : undefined
                const content = (
                  <>
                    <span className="item-name">{itemName(item, data.dishes, products)}</span>
                    <span className="muted small">{itemDetails(item.ingredients, products, !!item.dishId)}</span>
                  </>
                )
                return (
                  <li key={item.id}>
                    {dish && (dish.howTo || dish.ingredients.length) ? (
                      <button className="item tappable" onClick={() => setOpen({ dish, item })}>
                        {content}
                        <span className="chev">›</span>
                      </button>
                    ) : (
                      <div className="item">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {day.length === 0 && <p className="muted center">В меню на этот день ничего нет.</p>}

      {open && <DishSheet dish={open.dish} ingredients={open.item.ingredients} onClose={() => setOpen(null)} />}
    </div>
  )
}
