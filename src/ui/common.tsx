import { useEffect, useState, type ReactNode } from 'react'
import { formatRange, planDay, toISO } from '../domain/calendar'
import type { PersonId } from '../domain/types'
import { useData } from '../store'

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** Number field that accepts both «1,5» and «1.5» and commits on every valid edit. */
export function NumInput({
  value,
  onChange,
  suffix,
  min = 0,
  className,
  placeholder,
}: {
  value: number | undefined
  onChange: (v: number) => void
  suffix?: string
  min?: number
  className?: string
  placeholder?: string
}) {
  const fmt = (v: number | undefined) => (v == null || Number.isNaN(v) ? '' : String(+v.toFixed(3)).replace('.', ','))
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    const parsed = Number(text.replace(',', '.'))
    if (parsed !== value) setText(fmt(value))
  }, [value])
  return (
    <span className={`num ${className ?? ''}`}>
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value.replace(',', '.'))
          if (e.target.value.trim() !== '' && !Number.isNaN(v) && v >= min) onChange(v)
        }}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  )
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      className={`check ${checked ? 'on' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
    >
      {checked ? '✓' : ''}
    </button>
  )
}

export function PersonToggle({ value, onChange }: { value: PersonId; onChange: (p: PersonId) => void }) {
  const { people } = useData().settings
  return (
    <div className="seg" role="tablist">
      {(['he', 'she'] as const).map((p) => (
        <button key={p} role="tab" aria-selected={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
          {people[p].name}
        </button>
      ))}
    </div>
  )
}

export function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="bar">
      <div className="bar-label">
        <span>{label}</span>
        <span>
          <b>{Math.round(value)}</b> / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function useCurrentWeek(): number {
  const { startDate } = useData().settings
  return Math.max(0, planDay(startDate, toISO(new Date())).week)
}

export function WeekPicker({ week, onChange }: { week: number; onChange: (w: number) => void }) {
  const { startDate } = useData().settings
  const current = useCurrentWeek()
  return (
    <div className="picker">
      <button className="icon-btn" disabled={week <= 0} onClick={() => onChange(week - 1)} aria-label="Предыдущая неделя">
        ‹
      </button>
      <div className="picker-mid">
        <b>
          Неделя {(week % 4) + 1}
          {week >= 4 && <span className="muted"> · цикл {Math.floor(week / 4) + 1}</span>}
        </b>
        <span className="muted">
          {formatRange(startDate, week)}
          {week === current && ' · текущая'}
        </span>
      </div>
      <button className="icon-btn" onClick={() => onChange(week + 1)} aria-label="Следующая неделя">
        ›
      </button>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
