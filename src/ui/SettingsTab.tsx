import { useRef } from 'react'
import { formatLong, parseISO, toISO } from '../domain/calendar'
import { PEOPLE } from '../domain/types'
import { isAppData, migrate, useData, useStore } from '../store'
import { Field, NumInput } from './common'

export function SettingsTab() {
  const data = useData()
  const { update, replace, reset } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const { startDate, people } = data.settings
  const isSunday = parseISO(startDate).getDay() === 0

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `meal-plan-${toISO(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text())
      if (!isAppData(parsed)) throw new Error('format')
      if (confirm('Заменить все текущие данные содержимым файла?')) replace(migrate(parsed))
    } catch {
      alert('Не получилось прочитать файл: это не резервная копия «Плана питания».')
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h3>Старт плана</h3>
        <Field label="День 1 — закупка и готовка">
          <input type="date" value={startDate} onChange={(e) => e.target.value && update((d) => (d.settings.startDate = e.target.value))} />
        </Field>
        <p className={`small ${isSunday ? 'muted' : 'warn'}`}>
          {formatLong(startDate)}
          {!isSunday && ' — не воскресенье. Закупка и готовка будут в этот день недели.'}
        </p>
        <p className="muted small">Цикл — 28 дней (4 недели), затем повторяется. Меню из 7 дней идёт по кругу.</p>
      </section>

      {PEOPLE.map((p) => (
        <section key={p} className="card">
          <Field label="Имя">
            <input value={people[p].name} onChange={(e) => update((d) => (d.settings.people[p].name = e.target.value))} />
          </Field>
          <div className="grid2">
            <Field label="Цель, ккал">
              <NumInput value={people[p].kcal} onChange={(v) => update((d) => (d.settings.people[p].kcal = v))} />
            </Field>
            <Field label="Цель, белок г">
              <NumInput value={people[p].protein} onChange={(v) => update((d) => (d.settings.people[p].protein = v))} />
            </Field>
            <Field label="Рост, см">
              <NumInput value={people[p].height} placeholder="—" onChange={(v) => update((d) => (d.settings.people[p].height = v))} />
            </Field>
            <Field label="Вес, кг">
              <NumInput value={people[p].weight} placeholder="—" onChange={(v) => update((d) => (d.settings.people[p].weight = v))} />
            </Field>
          </div>
        </section>
      ))}

      <section className="card">
        <h3>Данные</h3>
        <p className="muted small">Всё хранится только в этом браузере. Сохраняйте резервную копию, особенно после правок меню.</p>
        <div className="row">
          <button className="btn" onClick={exportJson}>
            Экспорт JSON
          </button>
          <button className="btn ghost" onClick={() => file.current?.click()}>
            Импорт JSON
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }}
          />
        </div>
        <button
          className="btn danger wide"
          onClick={() => confirm('Сбросить всё к исходной таблице? Правки меню, цены, галочки и остатки пропадут.') && reset()}
        >
          Сбросить к исходной таблице
        </button>
      </section>
    </div>
  )
}
