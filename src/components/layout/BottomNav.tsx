import { NavLink, useLocation } from 'react-router'
import { m } from 'framer-motion'
import { Home, Library, Search, Bookmark, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

const TABS = [
  { to: '/', label: 'خانه', icon: Home, match: (p: string) => p === '/' },
  { to: '/laws', label: 'قوانین', icon: Library, match: (p: string) => p.startsWith('/laws') || p.startsWith('/law/') },
  { to: '/search', label: 'جستجو', icon: Search, match: (p: string) => p.startsWith('/search') },
  { to: '/bookmarks', label: 'نشان‌ها', icon: Bookmark, match: (p: string) => p.startsWith('/bookmarks') },
  { to: '/settings', label: 'تنظیمات', icon: Settings, match: (p: string) => p.startsWith('/settings') || p.startsWith('/about') || p.startsWith('/tools') },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-surface/90 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-surface/80"
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={to} className="flex">
              <NavLink
                to={to}
                onClick={() => haptic('light')}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px] font-medium"
              >
                <span className="relative grid h-8 w-16 place-items-center">
                  {active && (
                    <m.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-brand-soft"
                      transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                    />
                  )}
                  <Icon className={cn('relative h-[22px] w-[22px] transition-colors', active ? 'text-brand-strong' : 'text-muted')} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cn('transition-colors', active ? 'text-fg' : 'text-muted')}>{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
