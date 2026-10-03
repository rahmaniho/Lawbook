import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Download, Share, PlusSquare, X } from 'lucide-react'
import { isIos, promptInstall, useInstallPrompt } from '../../hooks/useInstallPrompt'
import { getSettings, updateSettings } from '../../lib/settings'
import { useDataState } from '../../lib/data/store'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

const SNOOZE = 1000 * 60 * 60 * 24 * 10

/** بنر نصب (Add to Home Screen) برای اندروید/دسکتاپ و راهنمای iOS */
export function InstallBanner() {
  const { canPrompt, installed } = useInstallPrompt()
  const data = useDataState()
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const ios = typeof navigator !== 'undefined' && isIos()

  useEffect(() => {
    if (installed || data.state !== 'ready') return
    const dismissed = getSettings().installDismissedAt
    if (dismissed && Date.now() - dismissed < SNOOZE) return
    if (!canPrompt && !ios) return
    const t = setTimeout(() => setVisible(true), 6000)
    return () => clearTimeout(t)
  }, [canPrompt, installed, ios, data.state])

  const dismiss = () => {
    setVisible(false)
    updateSettings({ installDismissedAt: Date.now() })
  }

  return (
    <>
      <AnimatePresence>
        {visible && !installed && (
          <m.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 bottom-[calc(var(--nav-h)+var(--safe-bottom)+10px)] z-[55] mx-auto max-w-md rounded-3xl border border-line bg-surface p-4 shadow-float"
            role="dialog"
            aria-label="نصب اپلیکیشن"
          >
            <div className="flex items-start gap-3">
              <img src="/icons/192.png" alt="" className="h-12 w-12 rounded-2xl" width={48} height={48} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">کتابچه قانون را نصب کنید</p>
                <p className="mt-0.5 text-[13px] leading-6 text-muted">دسترسی سریع از صفحه اصلی، اجرای تمام‌صفحه و استفاده کامل بدون اینترنت.</p>
              </div>
              <button type="button" onClick={dismiss} aria-label="بستن" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  if (canPrompt) {
                    const r = await promptInstall()
                    if (r !== 'unavailable') setVisible(false)
                  } else setIosHelp(true)
                }}
              >
                <Download className="h-4.5 w-4.5" /> نصب
              </Button>
              <Button variant="secondary" onClick={dismiss}>
                بعداً
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <IosInstallSheet open={iosHelp} onClose={() => setIosHelp(false)} />
    </>
  )
}

export function IosInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="نصب روی iPhone / iPad">
      <ol className="space-y-4 text-[15px] leading-7">
        <li className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">۱</span>
          <span>
            صفحه را در <b>Safari</b> باز کنید و دکمه اشتراک‌گذاری <Share className="inline h-5 w-5 align-text-bottom text-brand" /> را بزنید.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">۲</span>
          <span>
            گزینه <b>«Add to Home Screen» / «افزودن به صفحه اصلی»</b> <PlusSquare className="inline h-5 w-5 align-text-bottom text-brand" /> را انتخاب کنید.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-strong">۳</span>
          <span>دکمه «Add» را بزنید؛ آیکن «کتابچه قانون» روی صفحه اصلی قرار می‌گیرد و آفلاین کار می‌کند.</span>
        </li>
      </ol>
    </Sheet>
  )
}
