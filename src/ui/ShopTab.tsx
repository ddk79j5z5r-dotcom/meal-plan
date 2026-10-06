import { useState } from 'react'
import { formatRange } from '../domain/calendar'
import { cycleSummary, formatBuy, formatRub, priceAt, purchases, sumCost, type PurchaseRow } from '../domain/plan'
import { CATEGORIES, type AppData } from '../domain/types'
import { useData, useStore } from '../store'
import { Check, Field, NumInput, PriceDelta, Sheet, useCurrentWeek, WeekPicker } from './common'
import { CATEGORY_COLOR, CATEGORY_ICON, tint } from './colors'
import { PriceStats } from './PriceStats'

/** Set a product's price from `week` onwards, or remove the change at `week` when `value` is null. */
function setPriceAt(draft: AppData, productId: string, week: number, value: number | null) {
  const map = { ...(draft.prices[productId] ?? {}) }
  if (value == null) delete map[week]
  else map[week] = value
  if (Object.keys(map).length) draft.prices[productId] = map
  else delete draft.prices[productId]
}

export function ShopTab() {
  const data = useData()
  const current = useCurrentWeek()
  const [week, setWeek] = useState(current)
  const [hideBought, setHideBought] = useState(false)
  const [priceMode, setPriceMode] = useState(false)
  const [view, setView] = useState<'list' | 'stats'>('list')
  const [open, setOpen] = useState<PurchaseRow | null>(null)

  const cycle = Math.floor(week / 4)
  const monthly = week % 4 === 0 ? purchases(data, 'cycle', cycle) : []
  const weekly = purchases(data, 'week', week)
  const all = [...monthly, ...weekly].filter((r) => r.buy > 0)
  const bought = all.filter((r) => data.checks[`bought:${r.key}`])
  const total = sumCost(all)
  const left = total - sumCost(bought)

  // Reopen the edited row with fresh numbers after an edit.
  const openRow = open && [...monthly, ...weekly].find((r) => r.key === open.key)

  return (
    <div className="page">
      <WeekPicker week={week} onChange={setWeek} />
      <div className="seg">
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
          Список
        </button>
        <button className={view === 'stats' ? 'on' : ''} onClick={() => setView('stats')}>
          Статистика
        </button>
      </div>
      {view === 'stats' ? (
        <PriceStats cycle={cycle} week={week} />
      ) : (
        <>
      <div className="card summary hero">
        <div>
          <b>{formatRub(total)}</b>
          <span className="muted small">
            {bought.length} из {all.length} куплено · осталось {formatRub(left)}
          </span>
        </div>
        <div className="summary-toggles">
          <label className="switch small">
            <input type="checkbox" checked={hideBought} onChange={(e) => setHideBought(e.target.checked)} />
            Скрыть купленное
          </label>
          <label className="switch small">
            <input type="checkbox" checked={priceMode} onChange={(e) => setPriceMode(e.target.checked)} />
            Править цены
          </label>
        </div>
      </div>
      {priceMode && (
        <p className="muted small">
          Цены недели {(week % 4) + 1}: новая цена действует с этой недели и дальше, прошлые недели не меняются. Бакалея «раз в месяц» — по цене первой недели цикла.
        </p>
      )}

      {monthly.length > 0 && (
        <>
          <h3 className="cat" style={tint(CATEGORY_COLOR['Бакалея'])}>
            <span aria-hidden>📦</span> Раз в месяц · на 4 недели
          </h3>
          <RowList rows={monthly} hideBought={hideBought} priceWeek={week} priceMode={priceMode} onOpen={setOpen} color={CATEGORY_COLOR['Бакалея']} />
        </>
      )}
      {CATEGORIES.map((cat) => {
        const rows = weekly.filter((r) => r.product.category === cat)
        if (rows.length === 0) return null
        return (
          <section key={cat}>
            <h3 className="cat" style={tint(CATEGORY_COLOR[cat])}>
              <span aria-hidden>{CATEGORY_ICON[cat]}</span> {cat}
            </h3>
            <RowList rows={rows} hideBought={hideBought} priceWeek={week} priceMode={priceMode} onOpen={setOpen} color={CATEGORY_COLOR[cat]} />
          </section>
        )
      })}

      <CycleTotals cycle={cycle} />
        </>
      )}

      {openRow && <RowSheet row={openRow} week={week} onClose={() => setOpen(null)} />}
    </div>
  )
}

function RowList({
  rows,
  hideBought,
  priceMode,
  priceWeek,
  onOpen,
  color,
}: {
  rows: PurchaseRow[]
  hideBought: boolean
  priceMode: boolean
  priceWeek: number
  onOpen: (r: PurchaseRow) => void
  color: string
}) {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
  const update = useStore((s) => s.update)
  const visible = rows.filter((r) => !(hideBought && (data.checks[`bought:${r.key}`] || r.buy === 0)))
  if (visible.length === 0) return <p className="muted small">Всё куплено.</p>
  return (
    <ul className="card list tinted" style={tint(color)}>
      {visible.map((r) => {
        const key = `bought:${r.key}`
        const done = !!data.checks[key] || r.buy === 0
        return (
          <li key={r.key} className={done ? 'done' : ''}>
            <div className="shop-row">
              {r.buy > 0 ? <Check checked={!!data.checks[key]} onChange={() => toggle(key)} label={`${r.product.name}: куплено`} /> : <span className="check placeholder" />}
              <button className="item tappable" onClick={() => onOpen(r)}>
                <span className="item-name">{r.product.name}</span>
                <span className="muted small">
                  {r.buy > 0 ? '' : 'хватает остатка · '}
                  нужно {formatBuy(r.product, r.need)}
                  {r.leftover > 0 && ` · остаток ${formatBuy(r.product, r.leftover)}`}
                  {r.leftoverOverridden && ' ✎'}
                </span>
              </button>
              {priceMode ? (
                <NumInput
                  className={`price-input ${r.priceSetHere ? 'changed' : ''}`}
                  value={r.price}
                  suffix={`₽/${r.product.buyUnit}`}
                  onChange={(v) => update((d) => setPriceAt(d, r.product.id, priceWeek, v))}
                />
              ) : (
                <div className="shop-buy">
                  <b>{r.buy > 0 ? formatBuy(r.product, r.buy) : '—'}</b>
                  <span className="muted small">
                    {r.price !== r.product.price && <PriceDelta base={r.product.price} current={r.price} />}
                    {r.buy > 0 ? formatRub(r.cost) : ''}
                  </span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function RowSheet({ row, week, onClose }: { row: PurchaseRow; week: number; onClose: () => void }) {
  const data = useData()
  const update = useStore((s) => s.update)
  const p = row.product
  const history = Object.entries(data.prices[p.id] ?? {})
    .map(([w, price]) => ({ week: Number(w), price }))
    .sort((a, b) => a.week - b.week)
  const start = data.settings.startDate
  const people = data.settings.people
  return (
    <Sheet title={p.name} onClose={onClose}>
      <ul className="ing-list">
        {p.fixedPerCycle == null && (
          <>
            <li>
              <span>{people.he.name}</span>
              <b>{formatBuy(p, row.needHe)}</b>
            </li>
            <li>
              <span>{people.she.name}</span>
              <b>{formatBuy(p, row.needShe)}</b>
            </li>
          </>
        )}
        <li>
          <span>Нужно всего</span>
          <b>{formatBuy(p, row.need)}</b>
        </li>
        <li>
          <span>Остаток с прошлого раза</span>
          <b>{formatBuy(p, row.leftover)}</b>
        </li>
        <li>
          <span>Купить (шаг {formatBuy(p, p.packStep)})</span>
          <b>{formatBuy(p, row.buy)}</b>
        </li>
        <li>
          <span>Сумма</span>
          <b>{formatRub(row.cost)}</b>
        </li>
      </ul>
      <Field label={`Цена за ${p.buyUnit} на неделе ${(week % 4) + 1} (${formatRange(start, week)}), ₽`}>
        <NumInput value={priceAt(data, p.id, week)} onChange={(v) => update((d) => setPriceAt(d, p.id, week, v))} />
      </Field>
      <p className="muted small">Новая цена действует с этой недели и дальше, пока вы её снова не поменяете. Прошлые недели не пересчитываются.</p>
      <h3>История цены</h3>
      <ul className="ing-list price-history">
        <li>
          <span>Базовая (из таблицы)</span>
          <b>{formatRub(p.price)}</b>
        </li>
        {history.map((h, i) => (
          <li key={h.week}>
            <span>
              с недели {(h.week % 4) + 1}
              {h.week >= 4 && `, цикл ${Math.floor(h.week / 4) + 1}`} <span className="muted small">{formatRange(start, h.week)}</span>
            </span>
            <span className="row">
              <PriceDelta base={i === 0 ? p.price : history[i - 1].price} current={h.price} />
              <b>{formatRub(h.price)}</b>
              <button className="icon-btn" aria-label="Удалить изменение цены" onClick={() => update((d) => setPriceAt(d, p.id, h.week, null))}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Field label={`Фактический остаток, ${p.buyUnit}`}>
        <NumInput
          value={row.leftover / p.buyFactor}
          onChange={(v) => update((d) => (d.leftovers[row.key] = Math.round(v * p.buyFactor * 1000) / 1000))}
        />
      </Field>
      <p className="muted small">
        Остаток считается сам: прошлый остаток + куплено − съедено. Поправьте, если что-то испортилось или съели больше — следующие недели пересчитаются.
      </p>
      {row.leftoverOverridden && (
        <button
          className="btn small ghost"
          onClick={() =>
            update((d) => {
              delete d.leftovers[row.key]
            })
          }
        >
          Вернуть расчётный остаток
        </button>
      )}
    </Sheet>
  )
}

function CycleTotals({ cycle }: { cycle: number }) {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
  const s = cycleSummary(data, cycle)
  const start = data.settings.startDate
  return (
    <section className="card">
      <h3>Итого за цикл {cycle + 1} (4 недели)</h3>
      <ul className="ing-list">
        <li>
          <span>Раз в месяц: бакалея, масла, специи</span>
          <b>{formatRub(s.monthly)}</b>
        </li>
        {s.weeks.map((w, i) => (
          <li key={i}>
            <span>
              Неделя {i + 1} <span className="muted small">{formatRange(start, cycle * 4 + i)}</span>
            </span>
            <b>{formatRub(w)}</b>
          </li>
        ))}
        <li className="total">
          <span>Еда за 4 недели</span>
          <b>{formatRub(s.food)}</b>
        </li>
      </ul>
      <details>
        <summary>Посуда и расходники (разово, необязательно) · {formatRub(s.cookware)}</summary>
        <ul className="list">
          {data.cookware.map((c) => (
            <li key={c.id} className={data.checks[`cw:${c.id}`] ? 'done' : ''}>
              <div className="shop-row">
                <Check checked={!!data.checks[`cw:${c.id}`]} onChange={() => toggle(`cw:${c.id}`)} label={`${c.name}: куплено`} />
                <span className="item">
                  <span className="item-name">{c.name}</span>
                </span>
                <div className="shop-buy">
                  <b>
                    {c.qty} {c.unit}
                  </b>
                  <span className="muted small">{formatRub(c.qty * c.price)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
