import { useState, type ReactNode } from 'react'
import { addDays, formatShort, parseISO, weekStart } from '../domain/calendar'
import {
  batchesFor,
  batchTimes,
  containerCount,
  containerPlan,
  COOL_MINUTES,
  cookingPlan,
  dailyPlan,
  eveningPrep,
  eveningTransfers,
  formatClock,
  formatDuration,
  midweekPlan,
  portionCount,
  schedule,
  specOf,
  thawFor,
  type CookRow,
  type Place,
  type Portion,
} from '../domain/cooking'
import { formatAmount, formatBulk, productMap, type ProductMap } from '../domain/plan'
import type { Dish } from '../domain/types'
import { PEOPLE } from '../domain/types'
import { useData, useStore } from '../store'
import { Check, useCurrentWeek, WeekPicker } from './common'
import { CATEGORY_COLOR, tint } from './colors'
import { DishSheet, shortName } from './DishSheet'

type View = 'time' | 'what' | 'boxes' | 'recipes'

const PLACE: Record<Place, { icon: string; label: string }> = {
  fridge: { icon: '🧊', label: 'холодильник' },
  freezer: { icon: '❄️', label: 'морозилка' },
  fresh: { icon: '🍳', label: 'готовить в середине недели' },
  pantry: { icon: '🫙', label: 'банка в шкафу, залить с вечера' },
}

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

export function CookTab() {
  const data = useData()
  const [week, setWeek] = useState(useCurrentWeek())
  const [view, setView] = useState<View>('time')
  const [open, setOpen] = useState<Dish | null>(null)
  const products = productMap(data.products)
  const plan = cookingPlan(data)
  const sched = schedule(plan)
  const boxes = containerCount(data)
  const fridge = plan.reduce((n, r) => n + r.fridge, 0)
  const freezer = plan.reduce((n, r) => n + r.freezer, 0)
  const thaw = thawFor(data, 0)
  const airfryerMinutes = sched.placed.filter((p) => p.spec.where === 'airfryer').reduce((n, p) => n + p.end - p.start, 0)
  const start = weekStart(data.settings.startDate, week)
  const dayLabel = (day: number) => {
    const iso = addDays(start, day)
    return `День ${day + 1} · ${weekday.format(parseISO(iso))}, ${formatShort(iso)}`
  }

  // A dish takes the colour of its main (first) ingredient's category.
  const dishColor = (d: Dish) => {
    const p = products.get(d.ingredients[0]?.productId)
    return p ? CATEGORY_COLOR[p.category] : 'var(--muted)'
  }

  return (
    <div className="page">
      <WeekPicker week={week} onChange={setWeek} />

      <section className="card summary hero cook-hero">
        <div>
          <b>≈ {formatDuration(sched.total)}</b>
          <span className="muted small">
            {plan.length} блюд · аэрогриль {formatDuration(airfryerMinutes)} · {boxes} контейнеров · 🧊 {fridge} порц. · ❄️ {freezer} порц.
          </span>
        </div>
      </section>

      {thaw.length > 0 && (
        <div className="banner">
          <b>🌙 Накануне вечером</b>
          {thaw.map((r) => (
            <span key={r.dish.id} className="small">
              {capitalize(r.dish.cook!.thaw!)} — {formatTotals(r, products)}
            </span>
          ))}
        </div>
      )}

      <div className="seg">
        {(
          [
            ['time', 'По шагам'],
            ['what', 'Блюда'],
            ['boxes', 'Контейнеры'],
            ['recipes', 'Рецепты'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'time' && <Timeline week={week} plan={plan} products={products} dishColor={dishColor} onOpen={setOpen} />}
      {view === 'what' && <WhatToCook plan={plan} products={products} dishColor={dishColor} dayLabel={dayLabel} onOpen={setOpen} />}
      {view === 'boxes' && <Containers products={products} dayLabel={dayLabel} />}
      {view === 'recipes' && (
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
      )}

      {open && <DishSheet dish={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatTotals(row: CookRow, products: ProductMap) {
  const only = row.dish.cook?.where === 'none' ? row.dish.cook.prepOnly : undefined
  return row.totals
    .filter((t) => !only || only.includes(t.productId))
    .map((t) => ({ t, p: products.get(t.productId) }))
    .filter(({ p }) => p && p.category !== 'Масла и специи')
    .map(({ t, p }) => `${shortName(p!)} ${formatBulk(p!, t.amount)}`)
    .join(', ')
}

// ---------- Timeline ----------

interface Event {
  at: number
  order: number
  key?: string
  color?: string
  body: ReactNode
}

function Timeline({
  week,
  plan,
  products,
  dishColor,
  onOpen,
}: {
  week: number
  plan: CookRow[]
  products: ProductMap
  dishColor: (d: Dish) => string
  onOpen: (d: Dish) => void
}) {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
  const sched = schedule(plan)
  const key = (k: string) => `cook:w${week}:${k}`
  const events: Event[] = []

  for (const p of sched.placed) {
    const { dish } = p.row
    const s = p.spec
    const fryer = s.where === 'airfryer'
    if (s.where === 'none') {
      events.push({
        at: p.start - s.prep,
        order: 1,
        key: key(dish.id),
        color: dishColor(dish),
        body: (
          <button className="timeline-body tappable" onClick={() => onOpen(dish)}>
            <span className="item-name">
              🥣 {dish.code && <span className="code">{dish.code}</span>} {dish.name}
            </span>
            <span className="small">
              {formatTotals(p.row, products)} — на {portionCount(p.row)} {portionCount(p.row) === 1 ? 'завтрак' : 'завтрака'}
            </span>
            {s.prepText && <span className="muted small">{capitalize(s.prepText)}.</span>}
            {s.evening && <span className="small timeline-heat">Вечером накануне: {s.evening}.</span>}
          </button>
        ),
      })
      continue
    }
    events.push({
      at: p.start - s.prep,
      order: 1,
      key: key(dish.id),
      color: dishColor(dish),
      body: (
        <button className="timeline-body tappable" onClick={() => onOpen(dish)}>
          <span className="item-name">
            {fryer ? '💨' : '🔥'} {dish.code && <span className="code">{dish.code}</span>} {dish.name}
          </span>
          <span className="small">{formatTotals(p.row, products)}</span>
          {s.prepText && <span className="muted small">{capitalize(s.prepText)}.</span>}
          <span className="small timeline-heat">
            {fryer ? (
              <>
                В {formatClock(p.start)} прогреть аэрогриль 3 мин до {s.temp} °C, затем{' '}
                {p.batches > 1 ? `${p.batches} партии по ${s.minutes} мин` : `${s.minutes} мин`}
                {p.batches > 1 && ` (по ${s.batchSize} порц.)`}
              </>
            ) : (
              <>
                На плиту в {formatClock(p.start)} на {s.minutes} мин{s.attended ? ', стоять рядом и помешивать' : ''}
              </>
            )}
            {s.heatNote && <span className="muted"> · {s.heatNote}</span>}
          </span>
        </button>
      ),
    })
    if (fryer) {
      batchTimes(p).forEach((b, i) => {
        const last = i === p.batches - 1
        events.push({
          at: b.end,
          order: -1,
          body: (
            <span className="muted small timeline-done">
              ⏰ {p.batches > 1 ? `Партия ${i + 1}/${p.batches} готова` : 'Готово'} — {last ? 'выложить' : 'выложить и заложить следующую'}: {dish.name}
            </span>
          ),
        })
      })
    } else {
      events.push({
        at: p.end,
        order: -1,
        body: (
          <span className="muted small timeline-done">
            ⏰ Снять с огня: {dish.name}
            {dish.code === 'Р13' || dish.code === 'Р18' ? ' — дать постоять 10 мин под крышкой' : ''}
            {dish.code === 'Р2' ? ' — переложить в холодную воду' : ''}
          </span>
        ),
      })
    }
  }

  events.push(
    {
      at: sched.cookedAt,
      order: 2,
      key: key('cool'),
      color: 'var(--snack)',
      body: (
        <>
          <span className="item-name">🌬 Остудить {COOL_MINUTES} мин</span>
          <span className="muted small">Крышки контейнеров приоткрыты, рис — тонким слоем. Горячее в закрытый контейнер не убирать.</span>
        </>
      ),
    },
    {
      at: sched.cookedAt + COOL_MINUTES,
      order: 2,
      key: key('pack'),
      color: 'var(--cat-dairy)',
      body: (
        <>
          <span className="item-name">📦 Разложить по контейнерам и подписать</span>
          <span className="muted small">🧊 Дни 1–3 — в холодильник, ❄️ остальное — в морозилку. Что куда — во вкладке «Контейнеры».</span>
        </>
      ),
    },
  )
  events.sort((a, b) => a.at - b.at || a.order - b.order)
  const keyed = events.filter((e) => e.key)
  const done = keyed.filter((e) => data.checks[e.key!]).length

  return (
    <>
      <p className="muted small">
        Сделано {done} из {keyed.length}. Время — от начала готовки. Аэрогриль — одна корзина: блюда идут друг за другом партиями, в один слой. Плита (4 конфорки) работает параллельно.
      </p>
      <ol className="timeline card">
        {events.map((e, i) => (
          <li key={i} className={`${e.key ? '' : 'minor'} ${e.key && data.checks[e.key] ? 'done' : ''}`} style={e.color ? tint(e.color) : undefined}>
            <span className="time-chip">{formatClock(e.at)}</span>
            {e.key ? <Check checked={!!data.checks[e.key]} onChange={() => toggle(e.key!)} label="Сделано" /> : <span className="check placeholder" />}
            <div className="timeline-content">{e.body}</div>
          </li>
        ))}
      </ol>
      <p className="muted small">💡 {data.cookTail}</p>
    </>
  )
}

// ---------- What to cook ----------

function WhatToCook({
  plan,
  products,
  dishColor,
  dayLabel,
  onOpen,
}: {
  plan: CookRow[]
  products: ProductMap
  dishColor: (d: Dish) => string
  dayLabel: (day: number) => string
  onOpen: (d: Dish) => void
}) {
  const data = useData()
  const people = data.settings.people
  const midweek = midweekPlan(data)
  const daily = dailyPlan(data)
  const row = (r: CookRow, withHeat = true) => (
    <li key={r.dish.id} className="dot-row" style={tint(dishColor(r.dish))}>
      <button className="item tappable" onClick={() => onOpen(r.dish)}>
        <span className="item-name">
          {r.dish.code && <span className="code">{r.dish.code}</span>} {r.dish.name}
        </span>
        <span className="small">{formatTotals(r, products)}</span>
        {PEOPLE.filter((p) => r.portions[p].count > 0).map((p) => (
          <span key={p} className="muted small">
            <i className={`swatch p-${p}`} aria-hidden /> {people[p].name}: {r.portions[p].count} порц. · дни {r.portions[p].days.join(', ')}
          </span>
        ))}
        {withHeat && (
          <span className="muted small">
            {specOf(r.dish).where === 'airfryer'
              ? `💨 ${specOf(r.dish).temp} °C · ${batchesFor(specOf(r.dish), portionCount(r))} × ${specOf(r.dish).minutes} мин`
              : specOf(r.dish).where === 'none'
                ? '🥣 без готовки · 🫙 по банкам, залить с вечера'
                : `🔥 плита · ${specOf(r.dish).minutes} мин`}
            {r.fridge > 0 && ` · 🧊 ${r.fridge}`}
            {r.freezer > 0 && ` · ❄️ ${r.freezer}`}
          </span>
        )}
        <span className="chev">›</span>
      </button>
    </li>
  )

  return (
    <>
      <h3 className="cat" style={tint('var(--cook)')}>
        <span aria-hidden>🥘</span> В день готовки · на двоих
      </h3>
      <ul className="card list">{plan.map((r) => row(r))}</ul>
      {midweek.length > 0 && (
        <>
          <h3 className="cat" style={tint('var(--lunch)')}>
            <span aria-hidden>🍳</span> В середине недели
          </h3>
          <p className="muted small">Эти блюда плохо переносят заморозку — на конец недели их проще приготовить свежими.</p>
          {midweek.map((m) => (
            <section key={m.day}>
              <p className="small">
                <b>{dayLabel(m.day)}</b>
              </p>
              <ul className="card list">{m.rows.map((r) => row(r))}</ul>
            </section>
          ))}
        </>
      )}
      {daily.length > 0 && (
        <>
          <h3 className="cat" style={tint('var(--breakfast)')}>
            <span aria-hidden>☀️</span> Каждый день, без заготовки
          </h3>
          <p className="muted small">Готовятся в день еды за несколько минут — рецепт по тапу.</p>
          <ul className="card list">{daily.map((r) => row(r, false))}</ul>
        </>
      )}
    </>
  )
}

// ---------- Containers ----------

function portionText(p: Portion, products: ProductMap) {
  const main = p.ingredients[0]
  return `${p.dish.name}${main ? ` ${formatAmount(products.get(main.productId), main.amount)}` : ''}`
}

function Containers({ products, dayLabel }: { products: ProductMap; dayLabel: (day: number) => string }) {
  const data = useData()
  const people = data.settings.people
  const days = containerPlan(data)
  const midweek = midweekPlan(data)

  return (
    <>
      <p className="muted small">
        🧊 холодильник · ❄️ морозилка (достать вечером накануне) · 🍳 приготовить свежим в середине недели
      </p>
      {days.map(({ day, boxes }) => {
        const transfers = day > 0 ? eveningTransfers(data, day - 1) : []
        const cookToday = midweek.find((m) => m.day === day)
        const thawToday = day > 0 ? thawFor(data, day) : []
        const soak = eveningPrep(data, (day + 6) % 7)
        return (
          <section key={day} className="card day-card">
            <h3>{dayLabel(day)}</h3>
            {transfers.length > 0 && (
              <p className="small note">
                ❄️→🧊 Вечером дня {day} достать из морозилки: {transfers.map((p) => `${p.dish.name.toLowerCase()} (${people[p.person].name})`).join(', ')}
              </p>
            )}
            {soak.length > 0 && (
              <p className="small note">
                🥣 Вечером накануне: {soak.map((p) => `${p.dish.name.toLowerCase()} (${people[p.person].name})`).join(', ')} — {soak[0].dish.cook!.evening}
              </p>
            )}
            {cookToday && (
              <p className="small note">
                🍳 Сегодня приготовить: {cookToday.rows.map((r) => `${r.dish.name.toLowerCase()} (${formatTotals(r, products)})`).join('; ')}
                {thawToday.length > 0 && ` · вечером накануне: ${thawToday.map((r) => r.dish.cook!.thaw).join(', ')}`}
              </p>
            )}
            {boxes.length === 0 && <p className="muted small">Без контейнеров.</p>}
            <ul className="boxes">
              {boxes.map((b, i) => (
                <li key={i} style={tint(`var(--${b.person})`)}>
                  <span className="box-who">
                    <i className={`swatch p-${b.person}`} aria-hidden /> {people[b.person].name} · {b.meal}
                  </span>
                  {b.portions.map((p, j) => (
                    <span key={j} className="small box-item">
                      <span title={PLACE[p.place].label}>{PLACE[p.place].icon}</span> {portionText(p, products)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
