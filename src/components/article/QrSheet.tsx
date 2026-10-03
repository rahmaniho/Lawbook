import { useEffect, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { copyText } from '../../lib/share'
import { toast } from '../../lib/toast'

/** نمایش QR کد پیوند ماده (برای اشتراک حضوری) */
export function QrSheet({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [svg, setSvg] = useState<string>('')
  useEffect(() => {
    if (!open) return
    let alive = true
    import('uqr').then(({ renderSVG }) => {
      if (alive) setSvg(renderSVG(url, { border: 2, ecc: 'M', pixelSize: 8, blackColor: '#0b2f2b', whiteColor: '#ffffff' }))
    })
    return () => {
      alive = false
    }
  }, [open, url])
  return (
    <Sheet open={open} onClose={onClose} title="QR کد ماده">
      <div className="flex flex-col items-center gap-4 pb-2">
        <p className="text-center text-sm text-muted">{title}</p>
        <div className="w-64 max-w-full overflow-hidden rounded-2xl border border-line bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="max-w-full break-all text-center text-[12px] text-muted" dir="ltr">
          {url}
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            if (await copyText(url)) toast('پیوند کپی شد', { tone: 'success' })
          }}
        >
          کپی پیوند
        </Button>
      </div>
    </Sheet>
  )
}
