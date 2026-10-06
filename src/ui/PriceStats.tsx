import { formatRange } from '../domain/calendar'
import { cycleStats, formatRub } from '../domain/plan'
import { useData } from '../store'
import { CATEGORY_COLOR, CATEGORY_ICON, tint } from './colors'
import { PriceDelta } from './common'

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export function PriceStats({ cycle, week }: { cycle: number; week: number }) {
  const data = useData()
  const s = cycleStats(data, cycle)
  const { people, startDate } = data.settings
  const maxWeek = Math.max(...s.summary.weeks, 1)
  const maxCat = Math.max(...s.byCategory.map((c) => c.cost), 1)
  const priceEffect = s.summary.food - s.foodAtBase

  return (
    <>
      <div className="kpis">
        <div className="kpi wide">
          <span className="muted small">Еда за цикл {cycle + 1} · 4 недели</span>
          <b>{formatRub(s.summary.food)}</b>
          {s.previousFood != null && (
            <span className="small">
              <PriceDelta base={s.previousFood} current={s.summary.food} />
              <span className="muted">к прошлому циклу ({formatRub(s.previousFood)})</span>
            </span>
          )}
        </div>
        <div className="kpi">
          <span className="muted small">В день на двоих</span>
          <b>{formatRub(s.perDay)}</b>
        </div>
        <div className="kpi">
          <span className="muted small">В неделю</span>
          <b>{formatRub(s.summary.food / 4)}</b>
        </div>
        {(['he', 'she'] as const).map((p) => (
          <div key={p} className="kpi">
            <span className="muted small">
              <i className={`swatch p-${p}`} aria-hidden /> {people[p].name} в день
            </span>
            <b>{formatRub(s.perPersonDay[p])}</b>
            <span className="muted small">{pct(s.perPersonDay[p], s.perDay)}% бюджета</span>
          </div>
        ))}
      </div>

      <section className="card">
        <h3>По неделям</h3>
        <div className="vbars" role="img" aria-label="Стоимость закупки по неделям">
          {s.summary.weeks.map((cost, i) => {
            const w = cycle * 4 + i
            return (
              <div key={i} className={`vbar ${w === week ? 'current' : ''}`} title={`Неделя ${i + 1}, ${formatRange(startDate, w)}: ${formatRub(cost)}`}>
                <span className="vbar-value">{formatRub(cost)}</span>
                <div className="vbar-track">
                  <div className="vbar-fill" style={{ height: `${(cost / maxWeek) * 100}%` }} />
                </div>
                <span className="vbar-label">Нед. {i + 1}</span>
              </div>
            )
          })}
        </div>
        <p className="muted small">Плюс раз в месяц (бакалея, масла, специи): {formatRub(s.summary.monthly)}. Первая неделя обычно дороже: запас докупается с округлением до упаковки, потом его хватает надолго.</p>
      </section>

      <section className="card">
        <h3>По категориям</h3>
        <ul className="hbars">
          {s.byCategory.map((c) => (
            <li key={c.category} style={tint(CATEGORY_COLOR[c.category])} title={`${c.category}: ${formatRub(c.cost)}`}>
              <div className="hbar-head">
                <span>
                  <span aria-hidden>{CATEGORY_ICON[c.category]}</span> {c.category}
                </span>
                <span>
                  <b>{formatRub(c.cost)}</b> <span className="muted small">{pct(c.cost, s.summary.food)}%</span>
                </span>
              </div>
              <div className="hbar-track">
                <div className="hbar-fill" style={{ width: `${(c.cost / maxCat) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Самое дорогое в цикле</h3>
        <ol className="top-list">
          {s.top.map((t) => (
            <li key={t.product.id}>
              <i className="swatch" style={{ background: CATEGORY_COLOR[t.product.category] }} aria-hidden />
              <span className="top-name">{t.product.name}</span>
              <b>{formatRub(t.cost)}</b>
              <span className="muted small">{pct(t.cost, s.summary.food)}%</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h3>Изменения цен</h3>
        {s.changes.length === 0 ? (
          <p className="muted small">Цены пока как в таблице. Включите «Править цены» в списке покупок и вводите цены из магазина — здесь появится, что подорожало и насколько это меняет бюджет.</p>
        ) : (
          <>
            <p className="small">
              Из‑за изменения цен цикл {priceEffect >= 0 ? 'дороже' : 'дешевле'} на <b>{formatRub(Math.abs(priceEffect))}</b>{' '}
              <PriceDelta base={s.foodAtBase} current={s.summary.food} />
            </p>
            <ul className="ing-list">
              {s.changes.map((c) => (
                <li key={c.product.id}>
                  <span>{c.product.name}</span>
                  <span className="nowrap">
                    <PriceDelta base={c.base} current={c.current} />
                    <span className="muted small">{c.base} →</span> <b>{formatRub(c.current)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  )
}
