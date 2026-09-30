import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Today', icon: '🍽️' },
  { to: '/history', label: 'History', icon: '📅' },
  { to: '/stats', label: 'Stats', icon: '📊' },
] as const

export default function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive ? 'text-brand-700' : 'text-stone-500'
                }`
              }
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {tab.icon}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
