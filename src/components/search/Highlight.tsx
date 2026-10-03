import { Fragment, useMemo } from 'react'
import { buildHighlightRegex, toFaDigits } from '../../lib/normalize'

export function Highlight({ text, terms, persian = true }: { text: string; terms: string[]; persian?: boolean }) {
  const re = useMemo(() => buildHighlightRegex(terms), [terms])
  const display = persian ? toFaDigits(text) : text
  if (!re) return <>{display}</>
  const parts = display.split(re)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark className="hl" key={i}>
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}
