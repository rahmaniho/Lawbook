import { Fragment, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { buildHighlightRegex, toFaDigits } from '../../lib/normalize'
import { articlePath, cn } from '../../lib/utils'

const MARKER_RE = /(\((?:اصلاحی|الحاقی|منسوخ|ملغی|حذف)[^()]*\)\s*-?)/
const REF_RE = /((?:ماده|مواد)\s*\(?\s*\d+\s*\)?)/
const COMBINED = new RegExp(`${MARKER_RE.source}|${REF_RE.source}`, 'g')

function highlight(text: string, re: RegExp | null, keyBase: string): ReactNode {
  if (!re) return text
  const parts = text.split(re)
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={`${keyBase}-h${i}`} className="hl">
        {p}
      </mark>
    ) : (
      <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>
    ),
  )
}

/**
 * نمایش متن ماده: پاراگراف‌بندی، برجسته‌سازی نشانگرهای اصلاح/الحاق،
 * یادداشت‌های ویراستاری منبع ([…]) و پیوند ارجاعات داخلی به مواد همین قانون.
 */
export function ArticleText({
  text,
  lawId,
  refKeys,
  persian = true,
  terms,
  className,
}: {
  text: string
  lawId: string
  refKeys?: Set<string>
  persian?: boolean
  terms?: string[]
  className?: string
}) {
  const hlRe = useMemo(() => (terms?.length ? buildHighlightRegex(terms) : null), [terms])
  const lines = text.split('\n').filter((l) => l.trim())
  return (
    <div className={cn('law-text', className)}>
      {lines.map((line, li) => {
        const isEditorial = /^\[.*\]\.?$/.test(line.trim())
        const disp = persian ? toFaDigits(line) : line
        if (isEditorial)
          return (
            <span key={li} className="law-editorial">
              {highlight(disp, hlRe, `e${li}`)}
            </span>
          )
        const nodes: ReactNode[] = []
        let last = 0
        COMBINED.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = COMBINED.exec(disp))) {
          if (m.index > last) nodes.push(<Fragment key={`${li}-${last}`}>{highlight(disp.slice(last, m.index), hlRe, `${li}-${last}`)}</Fragment>)
          if (m[1]) {
            nodes.push(
              <span key={`${li}-m${m.index}`} className="law-marker">
                {m[1].replace(/\s*-$/, '')}
              </span>,
            )
            if (/-\s*$/.test(m[1])) nodes.push(' ')
          } else if (m[2]) {
            const num = m[2].replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            // ارجاع به ماده‌ای از قانون دیگر را پیوند نمی‌دهیم
            const tail = disp.slice(m.index + m[2].length, m.index + m[2].length + 30)
            const external = /^\s*\)?\s*(قانون|آیین|آئین|لایحه)/.test(tail) && !/^\s*\)?\s*(این|همین)\s+قانون/.test(tail)
            if (refKeys?.has(num) && !external) {
              nodes.push(
                <Link key={`${li}-r${m.index}`} to={articlePath(lawId, num)} className="law-ref">
                  {m[2]}
                </Link>,
              )
            } else nodes.push(<Fragment key={`${li}-r${m.index}`}>{highlight(m[2], hlRe, `${li}-r${m.index}`)}</Fragment>)
          }
          last = m.index + m[0].length
        }
        if (last < disp.length) nodes.push(<Fragment key={`${li}-end`}>{highlight(disp.slice(last), hlRe, `${li}-end`)}</Fragment>)
        return <p key={li}>{nodes}</p>
      })}
    </div>
  )
}
