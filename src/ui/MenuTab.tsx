import { useMemo, useState } from 'react'
import { dayNutrition, formatInt, nutritionOf, productMap } from '../domain/plan'
import { CATEGORIES, type AppData, type Dish, type Ingredient, type PersonId, type Product, type Unit } from '../domain/types'
import { uid, useData, useStore } from '../store'
import { Field, Macros, NumInput, PersonToggle, Sheet } from './common'
import { CATEGORY_COLOR, CATEGORY_ICON, mealStyle, tint } from './colors'
import { itemDetails, itemName } from './DishSheet'

type Sub = 'menu' | 'dishes' | 'products'

export function MenuTab({ person, setPerson }: { person: PersonId; setPerson: (p: PersonId) => void }) {
  const [sub, setSub] = useState<Sub>('menu')
  return (
    <div className="page">
      <div className="seg">
        {(
          [
            ['menu', 'Меню недели'],
            ['dishes', 'Блюда'],
            ['products', 'Продукты'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>
            {label}
          </button>
        ))}
      </div>
      {sub === 'menu' && <WeekMenu person={person} setPerson={setPerson} />}
      {sub === 'dishes' && <DishList />}
      {sub === 'products' && <ProductList />}
    </div>
  )
}

// ---------- Weekly template ----------

function WeekMenu({ person, setPerson }: { person: PersonId; setPerson: (p: PersonId) => void }) {
  const data = useData()
  const update = useStore((s) => s.update)
  const [day, setDay] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const products = productMap(data.products)
  const meals = data.menu[person][day]
  const total = dayNutrition(meals, products)
  const target = data.settings.people[person]

  const edit = (fn: (meals: AppData['menu']['he'][number], d: AppData) => void) => update((d) => fn(d.menu[person][day], d))

  return (
    <>
      <PersonToggle value={person} onChange={setPerson} />
      <div className="chips">
        {data.menu[person].map((_, i) => (
          <button key={i} className={day === i ? 'on' : ''} onClick={() => setDay(i)}>
            День {i + 1}
          </button>
        ))}
      </div>
      <div className="card totals">
        <Stat label="ккал" value={total.kcal} target={target.kcal} color="var(--kcal)" />
        <Stat label="белок" value={total.p} target={target.protein} lowOnly color="var(--protein)" />
        <Stat label="жиры" value={total.f} color="var(--fat)" />
        <Stat label="углев." value={total.c} color="var(--carbs)" />
      </div>
      <p className="muted small">Правки меняют шаблон: этот день повторяется каждую неделю. Закупки и план готовки пересчитаются сами.</p>

      {meals.map((meal, mi) => (
        <section key={mi} className="card meal tinted" style={tint(mealStyle(meal.name).color)}>
          <header className="meal-head">
            <span aria-hidden>{mealStyle(meal.name).icon}</span>
            <input
              className="meal-name"
              value={meal.name}
              onChange={(e) => edit((m) => (m[mi].name = e.target.value))}
              aria-label="Название приёма пищи"
            />
            <span className="muted small">{formatInt(nutritionOf(meal.items.flatMap((i) => i.ingredients), products).kcal)} ккал</span>
            <button
              className="icon-btn danger"
              aria-label="Удалить приём пищи"
              onClick={() => confirm(`Удалить «${meal.name}» из дня ${day + 1}?`) && edit((m) => m.splice(mi, 1))}
            >
              🗑
            </button>
          </header>
          <ul className="items">
            {meal.items.map((item, ii) => {
              const open = editing === item.id
              return (
                <li key={item.id} className={open ? 'editing' : ''}>
                  <button className="item tappable" onClick={() => setEditing(open ? null : item.id)}>
                    <span className="item-name">{itemName(item, data.dishes, products)}</span>
                    <span className="muted small">{itemDetails(item.ingredients, products, !!item.dishId)}</span>
                    <span className="chev">{open ? '▾' : '✎'}</span>
                  </button>
                  {open && (
                    <div className="item-editor">
                      <IngredientsEditor
                        value={item.ingredients}
                        products={data.products}
                        onChange={(next) => edit((m) => (m[mi].items[ii].ingredients = next))}
                      />
                      <div className="row">
                        {item.dishId && (
                          <button
                            className="btn small ghost"
                            onClick={() =>
                              edit((m, d) => {
                                const dish = d.dishes.find((x) => x.id === item.dishId)
                                if (dish) m[mi].items[ii].ingredients = structuredClone(dish.ingredients)
                              })
                            }
                          >
                            Состав по умолчанию
                          </button>
                        )}
                        <button className="btn small danger" onClick={() => edit((m) => m[mi].items.splice(ii, 1))}>
                          Убрать из приёма
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <button className="btn small ghost" onClick={() => setAdding(mi)}>
            + Добавить блюдо или продукт
          </button>
        </section>
      ))}
      <button className="btn ghost wide" onClick={() => edit((m) => m.push({ name: 'Перекус', items: [] }))}>
        + Приём пищи
      </button>
      <CopyDay person={person} day={day} />

      {adding != null && (
        <AddItemSheet
          onClose={() => setAdding(null)}
          onPick={(dish, product) => {
            const id = uid()
            edit((m) =>
              m[adding].items.push(
                dish
                  ? { id, dishId: dish.id, ingredients: structuredClone(dish.ingredients) }
                  : { id, dishId: null, ingredients: [{ productId: product!.id, amount: defaultAmount(product!) }] },
              ),
            )
            setAdding(null)
            setEditing(id)
          }}
        />
      )}
    </>
  )
}

function CopyDay({ person, day }: { person: PersonId; day: number }) {
  const update = useStore((s) => s.update)
  const other: PersonId = person === 'he' ? 'she' : 'he'
  const [to, setTo] = useState('')
  return (
    <div className="row copy-day">
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Куда скопировать день">
        <option value="">Скопировать день {day + 1} в…</option>
        {Array.from({ length: 7 }, (_, i) => i)
          .filter((i) => i !== day)
          .map((i) => (
            <option key={i} value={`${person}:${i}`}>
              День {i + 1}
            </option>
          ))}
        <option value={`${other}:${day}`}>Тот же день у второго человека</option>
      </select>
      <button
        className="btn small"
        disabled={!to}
        onClick={() => {
          const [p, i] = to.split(':') as [PersonId, string]
          update((d) => {
            d.menu[p][+i] = structuredClone(d.menu[person][day]).map((m) => ({ ...m, items: m.items.map((it) => ({ ...it, id: uid() })) }))
          })
          setTo('')
        }}
      >
        Копировать
      </button>
    </div>
  )
}

function Stat({ label, value, target, lowOnly, color }: { label: string; value: number; target?: number; lowOnly?: boolean; color: string }) {
  const off = target ? value / target : 1
  const cls = target ? (off < 0.9 ? 'low' : off > 1.1 && !lowOnly ? 'high' : 'ok') : ''
  return (
    <div className={`stat ${cls}`} style={tint(color)}>
      <b>{formatInt(value)}</b>
      <span>
        {label}
        {target ? ` / ${formatInt(target)}` : ''}
      </span>
    </div>
  )
}

const defaultAmount = (p: Product) => (p.unit === 'pcs' ? 1 : 100)

// ---------- Ingredients editor ----------

export function IngredientsEditor({
  value,
  products,
  onChange,
}: {
  value: Ingredient[]
  products: Product[]
  onChange: (next: Ingredient[]) => void
}) {
  const pm = productMap(products)
  const unitLabel = (p?: Product) => (!p ? '' : p.unit === 'g' ? 'г' : p.unit === 'ml' ? 'мл' : (p.pieceLabel ?? 'шт'))
  return (
    <div className="ing-editor">
      {value.map((i, idx) => {
        const p = pm.get(i.productId)
        return (
          <div key={i.productId} className="ing-row">
            <span className="ing-name">{p?.name ?? i.productId}</span>
            <NumInput
              value={i.amount}
              suffix={unitLabel(p)}
              onChange={(v) => onChange(value.map((x, j) => (j === idx ? { ...x, amount: v } : x)))}
            />
            <button className="icon-btn" aria-label="Убрать продукт" onClick={() => onChange(value.filter((_, j) => j !== idx))}>
              ✕
            </button>
          </div>
        )
      })}
      <select
        value=""
        aria-label="Добавить продукт"
        onChange={(e) => {
          const p = pm.get(e.target.value)
          if (p) onChange([...value, { productId: p.id, amount: defaultAmount(p) }])
        }}
      >
        <option value="">+ продукт…</option>
        {CATEGORIES.map((cat) => (
          <optgroup key={cat} label={cat}>
            {products
              .filter((p) => p.category === cat && !value.some((v) => v.productId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function AddItemSheet({ onClose, onPick }: { onClose: () => void; onPick: (dish?: Dish, product?: Product) => void }) {
  const data = useData()
  const [q, setQ] = useState('')
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase())
  const dishes = data.dishes.filter((d) => d.ingredients.length > 0 && match(d.name))
  const products = data.products.filter((p) => match(p.name))
  return (
    <Sheet title="Добавить в приём пищи" onClose={onClose}>
      <input className="search" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <h3>Блюда</h3>
      <ul className="pick-list">
        {dishes.map((d) => (
          <li key={d.id}>
            <button onClick={() => onPick(d)}>
              {d.code && <span className="code">{d.code}</span>} {d.name}
            </button>
          </li>
        ))}
      </ul>
      <h3>Продукты</h3>
      <ul className="pick-list">
        {products.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(undefined, p)}>{p.name}</button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

// ---------- Dishes ----------

function usageCount(data: AppData, test: (i: { dishId: string | null; ingredients: Ingredient[] }) => boolean) {
  let n = 0
  for (const person of ['he', 'she'] as const) for (const day of data.menu[person]) for (const m of day) n += m.items.filter(test).length
  return n
}

function DishList() {
  const data = useData()
  const update = useStore((s) => s.update)
  const [open, setOpen] = useState<string | null>(null)
  const products = productMap(data.products)
  return (
    <>
      <button
        className="btn wide"
        onClick={() => {
          const id = `d_${uid()}`
          update((d) => d.dishes.push({ id, name: 'Новое блюдо', ingredients: [], howTo: '', storage: '', batch: true, custom: true }))
          setOpen(id)
        }}
      >
        + Новое блюдо
      </button>
      <ul className="card list">
        {data.dishes.map((d) => (
          <li key={d.id}>
            <button className="item tappable" onClick={() => setOpen(d.id)}>
              <span className="item-name">
                {d.code && <span className="code">{d.code}</span>} {d.name}
              </span>
              <span className="muted small">
                {itemDetails(d.ingredients, products) || 'без состава'}
                {d.batch ? ' · готовится на неделю' : ''}
              </span>
              <span className="chev">›</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <DishEditor id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function DishEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData()
  const update = useStore((s) => s.update)
  const idx = data.dishes.findIndex((d) => d.id === id)
  const dish = data.dishes[idx]
  const used = useMemo(() => usageCount(data, (i) => i.dishId === id), [data, id])
  if (!dish) return null
  const set = (fn: (d: Dish) => void) => update((draft) => fn(draft.dishes[idx]))
  const n = nutritionOf(dish.ingredients, productMap(data.products))

  return (
    <Sheet title={dish.code ? `${dish.code} · ${dish.name}` : dish.name} onClose={onClose}>
      <Field label="Название">
        <input value={dish.name} onChange={(e) => set((d) => (d.name = e.target.value))} />
      </Field>
      <label className="switch">
        <input type="checkbox" checked={dish.batch} onChange={(e) => set((d) => (d.batch = e.target.checked))} />
        Готовить в воскресенье на неделю
      </label>
      <h3>Состав на 1 порцию</h3>
      <IngredientsEditor value={dish.ingredients} products={data.products} onChange={(next) => set((d) => (d.ingredients = next))} />
      <p className="macros">
        <Macros n={n} />
      </p>
      <Field label="Приготовление">
        <textarea rows={5} value={dish.howTo} onChange={(e) => set((d) => (d.howTo = e.target.value))} />
      </Field>
      <Field label="Хранение">
        <textarea rows={2} value={dish.storage} onChange={(e) => set((d) => (d.storage = e.target.value))} />
      </Field>
      <p className="muted small">В меню встречается {used} раз. Состав в меню у каждого приёма свой; кнопка ниже заменит его на этот.</p>
      <div className="row">
        <button
          className="btn small"
          disabled={used === 0}
          onClick={() =>
            update((draft) => {
              for (const p of ['he', 'she'] as const)
                for (const day of draft.menu[p]) for (const m of day) for (const it of m.items) if (it.dishId === id) it.ingredients = structuredClone(dish.ingredients)
            })
          }
        >
          Применить состав ко всему меню
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (used > 0 && !confirm(`Блюдо есть в меню ${used} раз — убрать его и оттуда?`)) return
            if (used === 0 && !confirm(`Удалить «${dish.name}»?`)) return
            update((draft) => {
              draft.dishes = draft.dishes.filter((d) => d.id !== id)
              for (const p of ['he', 'she'] as const) for (const day of draft.menu[p]) for (const m of day) m.items = m.items.filter((it) => it.dishId !== id)
            })
            onClose()
          }}
        >
          Удалить блюдо
        </button>
      </div>
    </Sheet>
  )
}

// ---------- Products ----------

function ProductList() {
  const data = useData()
  const update = useStore((s) => s.update)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <button
        className="btn wide"
        onClick={() => {
          const id = `p_${uid()}`
          update((d) =>
            d.products.push({ id, name: 'Новый продукт', category: 'Овощи и фрукты', unit: 'g', buyUnit: 'кг', buyFactor: 1000, packStep: 100, price: 0, per100: { kcal: 0, p: 0, f: 0, c: 0 }, frequency: 'weekly' }),
          )
          setOpen(id)
        }}
      >
        + Новый продукт
      </button>
      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h3 className="cat" style={tint(CATEGORY_COLOR[cat])}>
            <span aria-hidden>{CATEGORY_ICON[cat]}</span> {cat}
          </h3>
          <ul className="card list tinted" style={tint(CATEGORY_COLOR[cat])}>
            {data.products
              .filter((p) => p.category === cat)
              .map((p) => (
                <li key={p.id}>
                  <button className="item tappable" onClick={() => setOpen(p.id)}>
                    <span className="item-name">{p.name}</span>
                    <span className="muted small">
                      {p.price} ₽/{p.buyUnit} · {p.per100.kcal} ккал, Б {p.per100.p} на 100 {p.unit === 'ml' ? 'мл' : 'г'} · {p.frequency === 'monthly' ? 'раз в месяц' : 'каждую неделю'}
                    </span>
                    <span className="chev">›</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {open && <ProductEditor id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

const UNIT_PRESETS: Record<Unit, { buyUnit: string; buyFactor: number; packStep: number; label: string }> = {
  g: { buyUnit: 'кг', buyFactor: 1000, packStep: 100, label: 'граммы (покупка в кг)' },
  ml: { buyUnit: 'л', buyFactor: 1000, packStep: 1000, label: 'миллилитры (покупка в л)' },
  pcs: { buyUnit: 'шт', buyFactor: 1, packStep: 1, label: 'штуки' },
}

function ProductEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData()
  const update = useStore((s) => s.update)
  const idx = data.products.findIndex((p) => p.id === id)
  const p = data.products[idx]
  const used = useMemo(
    () => usageCount(data, (i) => i.ingredients.some((x) => x.productId === id)) + data.dishes.filter((d) => d.ingredients.some((x) => x.productId === id)).length,
    [data, id],
  )
  if (!p) return null
  const set = (fn: (p: Product) => void) => update((d) => fn(d.products[idx]))
  const base = p.unit === 'ml' ? 'мл' : 'г'

  return (
    <Sheet title={p.name} onClose={onClose}>
      <Field label="Название">
        <input value={p.name} onChange={(e) => set((x) => (x.name = e.target.value))} />
      </Field>
      <Field label="Категория">
        <select value={p.category} onChange={(e) => set((x) => (x.category = e.target.value as Product['category']))}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      {used === 0 && (
        <Field label="Единица">
          <select
            value={p.unit}
            onChange={(e) =>
              set((x) => {
                const u = e.target.value as Unit
                Object.assign(x, { unit: u, ...UNIT_PRESETS[u] })
                if (u === 'pcs') Object.assign(x, { pieceLabel: 'шт', pieceWeight: 100 })
              })
            }
          >
            {(Object.keys(UNIT_PRESETS) as Unit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_PRESETS[u].label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid2">
        <Field label={`Цена за ${p.buyUnit}, ₽`}>
          <NumInput value={p.price} onChange={(v) => set((x) => (x.price = v))} />
        </Field>
        <Field label={`Шаг упаковки, ${p.buyUnit}`}>
          <NumInput value={p.packStep / p.buyFactor} onChange={(v) => v > 0 && set((x) => (x.packStep = Math.round(v * x.buyFactor * 1000) / 1000))} />
        </Field>
      </div>
      <Field label="Как часто покупать">
        <select value={p.frequency} onChange={(e) => set((x) => (x.frequency = e.target.value as Product['frequency']))}>
          <option value="weekly">Каждую неделю</option>
          <option value="monthly">Раз в месяц (в начале цикла)</option>
        </select>
      </Field>
      {p.fixedPerCycle != null && (
        <Field label={`Покупать за цикл, ${p.buyUnit} (не зависит от меню)`}>
          <NumInput value={p.fixedPerCycle / p.buyFactor} onChange={(v) => set((x) => (x.fixedPerCycle = v * x.buyFactor))} />
        </Field>
      )}
      {p.unit === 'pcs' && (
        <div className="grid2">
          <Field label="Название штуки">
            <input value={p.pieceLabel ?? ''} onChange={(e) => set((x) => (x.pieceLabel = e.target.value))} />
          </Field>
          <Field label="Вес штуки, г">
            <NumInput value={p.pieceWeight} onChange={(v) => set((x) => (x.pieceWeight = v))} />
          </Field>
        </div>
      )}
      <h3>На 100 {base}</h3>
      <div className="grid4">
        {(
          [
            ['kcal', 'ккал'],
            ['p', 'белки'],
            ['f', 'жиры'],
            ['c', 'углев.'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <NumInput value={p.per100[k]} onChange={(v) => set((x) => (x.per100[k] = v))} />
          </Field>
        ))}
      </div>
      <p className="muted small">
        Используется в меню и блюдах: {used}.
      </p>
      <button
        className="btn small danger"
        disabled={used > 0}
        onClick={() => {
          if (!confirm(`Удалить «${p.name}»?`)) return
          update((d) => (d.products = d.products.filter((x) => x.id !== id)))
          onClose()
        }}
      >
        {used > 0 ? 'Нельзя удалить: продукт используется' : 'Удалить продукт'}
      </button>
    </Sheet>
  )
}
