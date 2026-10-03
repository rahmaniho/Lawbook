import type { ReactNode } from 'react'

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand-strong">{icon}</div>
      <h2 className="mb-1.5 text-base font-bold">{title}</h2>
      {description && <p className="max-w-xs text-sm leading-7 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
