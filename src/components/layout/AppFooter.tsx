import { Link } from 'react-router'
import { CREDITS } from '../../lib/credits'
import { toFaDigits } from '../../lib/normalize'
import { cn } from '../../lib/utils'

/** فوتر همه صفحات: اعتبار و منبع پروژه (الزام مشخصات: اسپلش، درباره ما، فوتر) */
export function AppFooter({ immersive }: { immersive?: boolean }) {
  return (
    <footer className={cn('mx-auto w-full max-w-3xl px-4 pt-8', immersive ? 'pb-10' : 'pb-nav')} aria-label="اعتبار و منبع">
      <div className="border-t border-line pt-4 text-center text-[12px] leading-6 text-muted">
        <p>
          {CREDITS.compiler.role}: <span className="font-semibold text-fg">{CREDITS.compiler.name}</span>
        </p>
        <p>
          {CREDITS.developer.role}:{' '}
          <a href={CREDITS.developer.url} target="_blank" rel="noopener" className="font-semibold text-brand-strong">
            {CREDITS.developer.name} — {CREDITS.developer.host}
          </a>
        </p>
        <p className="mt-1">
          <Link to="/about" className="underline decoration-line underline-offset-4">
            درباره ما
          </Link>
          <span className="mx-2" aria-hidden="true">
            •
          </span>
          کتابچه قانون ایران • نسخه {toFaDigits(__APP_VERSION__)}
        </p>
      </div>
    </footer>
  )
}
