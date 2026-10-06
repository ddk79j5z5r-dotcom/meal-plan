import { useState } from 'react'
import { cookingPlan, formatBulk, productMap } from '../domain/plan'
import type { Dish } from '../domain/types'
import { PEOPLE } from '../domain/types'
import { useData, useStore } from '../store'
import { Check, useCurrentWeek, WeekPicker } from './common'
import { DishSheet, shortName } from './DishSheet'
import { CATEGORY_COLOR, tint } from './colors'

export function CookTab() {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
  const [week, setWeek] = useState(useCurrentWeek())
  const [open, setOpen] = useState<Dish | null>(null)
  const products = productMap(data.products)
  const plan = cookingPlan(data)
  const people = data.settings.people
  const stepKey = (n: number) => `step:w${week}:${n}`
  // A dish takes the colour of its main (first) ingredient's category.
  const dishColor = (d: Dish) => {
    const p = products.get(d.ingredients[0]?.productId)
    return p ? CATEGORY_COLOR[p.category] : 'var(--muted)'
  }
  const doneSteps = data.cookSteps.filter((s) => data.checks[stepKey(s.n)]).length

  return (
    <div className="page">
      <WeekPicker week={week} onChange={setWeek} />

      <h3 className="cat" style={tint('var(--cook)')}>
        <span aria-hidden>🥘</span> Что готовим на неделю · на двоих
      </h3>
      <ul className="card list">
        {plan.map((row) => (
          <li key={row.dish.id} className="dot-row" style={tint(dishColor(row.dish))}>
            <button className="item tappable" onClick={() => setOpen(row.dish)}>
              <span className="item-name">
                {row.dish.code && <span className="code">{row.dish.code}</span>} {row.dish.name}
              </span>
              <span className="small">
                {row.totals
                  .map((t) => ({ t, p: products.get(t.productId) }))
                  .filter(({ p }) => p && p.category !== 'Масла и специи')
                  .map(({ t, p }) => `${shortName(p!)} ${formatBulk(p!, t.amount)}`)
                  .join(', ')}
              </span>
              <span className="muted small">
                {PEOPLE.filter((p) => row.portions[p].count > 0)
                  .map((p) => `${people[p].name}: ${row.portions[p].count} порц. (дни ${row.portions[p].days.join(', ')})`)
                  .join(' · ')}
              </span>
              <span className="chev">›</span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="cat" style={tint('var(--cook)')}>
        <span aria-hidden>⏱</span> Порядок работы · {doneSteps}/{data.cookSteps.length}
      </h3>
      <ul className="card list steps tinted" style={tint('var(--cook)')}>
        {data.cookSteps.map((s) => {
          const done = !!data.checks[stepKey(s.n)]
          return (
            <li key={s.n} className={done ? 'done' : ''}>
              <div className="shop-row">
                <Check checked={done} onChange={() => toggle(stepKey(s.n))} label={`Шаг ${s.n}`} />
                <div className="item">
                  <span className="item-name">
                    <span className="code">{s.time}</span> {s.what}
                  </span>
                  {s.note && <span className="muted small">{s.note}</span>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="muted small">{data.cookTail}</p>
      <p className="muted small">Порядок работы написан под исходное меню — если вы сильно поменяли блюда, используйте его как ориентир.</p>

      <h3 className="cat" style={tint('var(--cook)')}>
        <span aria-hidden>📖</span> Все рецепты
      </h3>
      <ul className="card list">
        {data.dishes
          .filter((d) => d.howTo)
          .map((d) => (
            <li key={d.id} className="dot-row" style={tint(dishColor(d))}>
              <button className="item tappable" onClick={() => setOpen(d)}>
                <span className="item-name">
                  {d.code && <span className="code">{d.code}</span>} {d.name}
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
      </ul>

      {open && <DishSheet dish={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
