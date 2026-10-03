import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { TocNode } from '../../lib/types'
import { toFaDigits } from '../../lib/normalize'
import { cn } from '../../lib/utils'

interface TreeNode extends TocNode {
  children: TreeNode[]
}

function buildTree(toc: TocNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const t of toc) map.set(t.id, { ...t, children: [] })
  for (const t of toc) {
    const node = map.get(t.id)!
    if (t.parent && map.has(t.parent)) map.get(t.parent)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** فهرست مطالب درختی قانون (کتاب/باب/فصل/مبحث) */
export function TocTree({ toc, onSelect, unit = 'ماده' }: { toc: TocNode[]; onSelect: (node: TocNode) => void; unit?: string }) {
  const tree = useMemo(() => buildTree(toc), [toc])
  if (!toc.length) return <p className="py-6 text-center text-sm text-muted">این قانون بخش‌بندی ندارد.</p>
  return (
    <ul className="space-y-0.5">
      {tree.map((n) => (
        <Node key={n.id} node={n} onSelect={onSelect} unit={unit} />
      ))}
    </ul>
  )
}

function Node({ node, onSelect, unit }: { node: TreeNode; onSelect: (n: TocNode) => void; unit: string }) {
  const [open, setOpen] = useState(node.depth === 0 && node.children.length > 0 && node.children.length < 8)
  const has = node.children.length > 0
  return (
    <li>
      <div className={cn('flex items-center rounded-xl', node.depth === 0 ? 'bg-surface-2/60' : '')} style={{ paddingInlineStart: node.depth * 14 }}>
        {has ? (
          <button
            type="button"
            aria-label={open ? 'بستن' : 'باز کردن'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="grid h-10 w-9 shrink-0 place-items-center text-muted"
          >
            <ChevronLeft className={cn('h-4.5 w-4.5 transition-transform', open && '-rotate-90')} />
          </button>
        ) : (
          <span className="w-9 shrink-0" />
        )}
        <button type="button" onClick={() => node.first && onSelect(node)} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pe-3 text-start">
          <span className={cn('min-w-0 flex-1 text-[14px] leading-6', node.depth === 0 ? 'font-bold' : 'font-medium')}>{toFaDigits(node.title)}</span>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 text-[11.5px] text-muted">
            {toFaDigits(node.count)} {unit}
          </span>
        </button>
      </div>
      {has && open && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((c) => (
            <Node key={c.id} node={c} onSelect={onSelect} unit={unit} />
          ))}
        </ul>
      )}
    </li>
  )
}
