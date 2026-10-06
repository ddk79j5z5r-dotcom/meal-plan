import { useEffect, useState } from 'react'
import type { PersonId } from './domain/types'
import { tint } from './ui/colors'
import { CookTab } from './ui/CookTab'
import { MenuTab } from './ui/MenuTab'
import { SettingsTab } from './ui/SettingsTab'
import { ShopTab } from './ui/ShopTab'
import { Today } from './ui/Today'

export type Tab = 'today' | 'menu' | 'shop' | 'cook' | 'settings'

const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: 'today', label: 'Сегодня', icon: '🍽', color: 'var(--accent)' },
  { id: 'menu', label: 'Меню', icon: '📋', color: 'var(--dinner)' },
  { id: 'shop', label: 'Покупки', icon: '🛒', color: 'var(--cat-meat)' },
  { id: 'cook', label: 'Готовка', icon: '🍳', color: 'var(--cook)' },
  { id: 'settings', label: 'Настройки', icon: '⚙️', color: 'var(--cat-dairy)' },
]

const readHash = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'today'
}

function readPerson(): PersonId {
  try {
    return localStorage.getItem('meal-plan-person') === 'she' ? 'she' : 'he'
  } catch {
    return 'he'
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash)
  const [person, setPersonState] = useState<PersonId>(readPerson)

  useEffect(() => {
    const onHash = () => setTab(readHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const go = (t: Tab) => {
    location.hash = t
    scrollTo(0, 0)
  }
  const setPerson = (p: PersonId) => {
    setPersonState(p)
    try {
      localStorage.setItem('meal-plan-person', p)
    } catch {
      /* private mode */
    }
  }

  const current = TABS.find((t) => t.id === tab)!
  return (
    <div className={`app person-${person}`} style={tint(current.color)}>
      <header className="top">
        <h1>
          <span aria-hidden>{current.icon}</span> {current.label}
        </h1>
      </header>
      <main>
        {tab === 'today' && <Today person={person} setPerson={setPerson} go={go} />}
        {tab === 'menu' && <MenuTab person={person} setPerson={setPerson} />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'cook' && <CookTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} style={tint(t.color)} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
