import { useState } from 'react'
import { formatRange } from '../domain/calendar'
import { cycleSummary, formatBuy, formatRub, purchases, sumCost, type PurchaseRow } from '../domain/plan'
import { CATEGORIES } from '../domain/types'
import { useData, useStore } from '../store'
import { Check, Field, NumInput, Sheet, useCurrentWeek, WeekPicker } from './common'
import { CATEGORY_COLOR, CATEGORY_ICON, tint } from './colors'

export function ShopTab() {
  const data = useData()
  const current = useCurrentWeek()
  const [week, setWeek] = useState(current)
  const [hideBought, setHideBought] = useState(false)
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
      <div className="card summary hero">
        <div>
          <b>{formatRub(total)}</b>
          <span className="muted small">
            {bought.length} из {all.length} куплено · осталось {formatRub(left)}
          </span>
        </div>
        <label className="switch small">
          <input type="checkbox" checked={hideBought} onChange={(e) => setHideBought(e.target.checked)} />
          Скрыть купленное
        </label>
      </div>

      {monthly.length > 0 && (
        <>
          <h3 className="cat" style={tint(CATEGORY_COLOR['Бакалея'])}>
            <span aria-hidden>📦</span> Раз в месяц · на 4 недели
          </h3>
          <RowList rows={monthly} hideBought={hideBought} onOpen={setOpen} color={CATEGORY_COLOR['Бакалея']} />
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
            <RowList rows={rows} hideBought={hideBought} onOpen={setOpen} color={CATEGORY_COLOR[cat]} />
          </section>
        )
      })}

      <CycleTotals cycle={cycle} />

      {openRow && <RowSheet row={openRow} onClose={() => setOpen(null)} />}
    </div>
  )
}

function RowList({ rows, hideBought, onOpen, color }: { rows: PurchaseRow[]; hideBought: boolean; onOpen: (r: PurchaseRow) => void; color: string }) {
  const data = useData()
  const toggle = useStore((s) => s.toggle)
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
              <div className="shop-buy">
                <b>{r.buy > 0 ? formatBuy(r.product, r.buy) : '—'}</b>
                <span className="muted small">{r.buy > 0 ? formatRub(r.cost) : ''}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function RowSheet({ row, onClose }: { row: PurchaseRow; onClose: () => void }) {
  const data = useData()
  const update = useStore((s) => s.update)
  const idx = data.products.findIndex((p) => p.id === row.product.id)
  const p = row.product
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
      <Field label={`Цена за ${p.buyUnit}, ₽`}>
        <NumInput value={p.price} onChange={(v) => update((d) => (d.products[idx].price = v))} />
      </Field>
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
