import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Bell,
  ChevronLeft,
  Database,
  Download,
  FileDown,
  FileUp,
  Info,
  Moon,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Type,
  Vibrate,
  Hash,
  Calculator,
} from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Disclaimer } from '../components/layout/Disclaimer'
import { IosInstallSheet } from '../components/layout/InstallBanner'
import { requestBackgroundUpdate } from '../components/layout/UpdatePrompt'
import { ReaderSettings } from '../components/reader/ReaderSettings'
import { Sheet } from '../components/ui/Sheet'
import { Switch } from '../components/ui/Switch'
import { Segmented } from '../components/ui/Segmented'
import { Button } from '../components/ui/Button'
import { db } from '../lib/db'
import { META_KEY } from '../lib/data/sync'
import { refreshData, retryInstall, useDataState } from '../lib/data/store'
import { resetSearch } from '../lib/search/client'
import { updateSettings, useSettings } from '../lib/settings'
import { isIos, promptInstall, useInstallPrompt } from '../hooks/useInstallPrompt'
import { formatBytes, jalaliDate, relativeTime } from '../lib/format'
import { toFaDigits } from '../lib/normalize'
import { toast } from '../lib/toast'
import { subscribePush, pushSupported } from '../lib/push'
import { openInstallDialog } from '../lib/pwa-install'
import { QIndexOfflineRow } from '../components/settings/QIndexOfflineRow'

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold text-muted">
        {icon} {title}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-soft">{children}</div>
    </section>
  )
}

function Row({ label, hint, children, onClick }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-start">
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium">{label}</span>
        {hint && <span className="block text-[12px] leading-5 text-muted">{hint}</span>}
      </span>
      {children}
      {onClick && !children && <ChevronLeft className="h-4.5 w-4.5 text-muted" />}
    </Comp>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const data = useDataState()
  const { canPrompt, installed } = useInstallPrompt()
  const [readerOpen, setReaderOpen] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)
  const [usage, setUsage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const [confirmWipe, setConfirmWipe] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  useEffect(() => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.()
        const persisted = await navigator.storage?.persisted?.()
        setUsage({ usage: est?.usage, quota: est?.quota, persisted })
      } catch {
        /* ignore */
      }
    })()
  }, [data.meta?.updatedAt])

  const exportData = async () => {
    const payload = {
      app: 'ketabche-ghanoon',
      exportedAt: new Date().toISOString(),
      bookmarks: await db.bookmarks.toArray(),
      notes: await db.notes.toArray(),
      history: await db.history.toArray(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ketabche-ghanoon-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('پشتیبان ذخیره شد', { tone: 'success' })
  }

  const importData = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      if (json.app !== 'ketabche-ghanoon') throw new Error('فایل معتبر نیست')
      await db.transaction('rw', db.bookmarks, db.notes, async () => {
        for (const b of json.bookmarks ?? []) {
          if (!(await db.bookmarks.where('articleId').equals(b.articleId).first())) await db.bookmarks.add({ articleId: b.articleId, createdAt: b.createdAt ?? Date.now() })
        }
        for (const n of json.notes ?? []) {
          const ex = await db.notes.where('articleId').equals(n.articleId).first()
          if (!ex) await db.notes.add({ articleId: n.articleId, text: n.text, createdAt: n.createdAt ?? Date.now(), updatedAt: n.updatedAt ?? Date.now() })
        }
      })
      toast('نشان‌ها و یادداشت‌ها بازیابی شد', { tone: 'success' })
    } catch (e) {
      toast(`بازیابی ناموفق: ${e instanceof Error ? e.message : ''}`, { tone: 'error' })
    }
  }

  const wipePersonal = async () => {
    await Promise.all([db.bookmarks.clear(), db.notes.clear(), db.history.clear(), db.views.clear()])
    setConfirmWipe(false)
    toast('همه داده‌های شخصی پاک شد')
  }

  const reinstall = async () => {
    await db.meta.delete(META_KEY)
    await db.searchIndex.clear()
    await retryInstall()
    await resetSearch()
  }

  const askNotify = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') {
      updateSettings({ notifyBookmarkChanges: true })
      if (pushSupported()) await subscribePush().catch(() => undefined)
      toast('اعلان‌ها فعال شد', { tone: 'success' })
    }
  }

  const meta = data.meta

  return (
    <div className="pb-2">
      <AppBar title="تنظیمات" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        <Section title="ظاهر" icon={<Palette className="h-4 w-4" />}>
          <div className="px-4 py-3.5">
            <p className="mb-2 flex items-center gap-2 text-[14.5px] font-medium">
              <Moon className="h-4 w-4" /> حالت نمایش
            </p>
            <Segmented
              value={s.theme}
              onChange={(v) => updateSettings({ theme: v, readerTheme: s.readerTheme === 'sepia' && v === 'dark' ? 'auto' : s.readerTheme })}
              options={[
                { value: 'system', label: 'خودکار (سیستم)' },
                { value: 'light', label: 'روشن' },
                { value: 'dark', label: 'تیره' },
              ]}
            />
          </div>
          <Row label={<span className="flex items-center gap-2"><Hash className="h-4 w-4" /> نمایش اعداد فارسی</span>} hint="۱۲۳ به‌جای 123 در متن قوانین">
            <Switch checked={s.persianDigits} onChange={(v) => updateSettings({ persianDigits: v })} label="اعداد فارسی" />
          </Row>
          <Row label={<span className="flex items-center gap-2"><Vibrate className="h-4 w-4" /> بازخورد لمسی</span>} hint="لرزش کوتاه هنگام نشان‌گذاری و حرکات لمسی">
            <Switch checked={s.haptics} onChange={(v) => updateSettings({ haptics: v })} label="بازخورد لمسی" />
          </Row>
          <Row label={<span className="flex items-center gap-2"><Type className="h-4 w-4" /> تنظیمات مطالعه</span>} hint={`قلم ${s.readerFont === 'naskh' ? 'نسخ' : 'وزیرمتن'} • اندازه ${toFaDigits(s.fontScale)} • فاصله خطوط ${toFaDigits(s.lineHeight.toFixed(1))}`} onClick={() => setReaderOpen(true)} />
        </Section>

        <Section title="جستجو" icon={<Search className="h-4 w-4" />}>
          <Row label="جستجوی مفهومی (هم‌معنایابی)" hint="گسترش پرس‌وجو با واژه‌نامه مفاهیم حقوقی؛ کاملاً آفلاین">
            <Switch checked={s.semanticSearch} onChange={(v) => updateSettings({ semanticSearch: v })} label="جستجوی مفهومی" />
          </Row>
          <Row label="پاک کردن تاریخچه جستجو" onClick={() => void db.history.clear().then(() => toast('تاریخچه جستجو پاک شد'))}>
            <Trash2 className="h-4.5 w-4.5 text-danger" />
          </Row>
        </Section>

        <Section title="داده‌های قوانین" icon={<Database className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3 px-4 py-3.5 text-[13px]">
            <div>
              <p className="text-muted">نسخه داده</p>
              <p className="font-bold">{meta ? toFaDigits(meta.version) : '—'}</p>
            </div>
            <div>
              <p className="text-muted">تعداد مواد</p>
              <p className="font-bold">{meta ? toFaDigits(meta.articleCount.toLocaleString('fa-IR')) : '—'}</p>
            </div>
            <div>
              <p className="text-muted">آخرین به‌روزرسانی</p>
              <p className="font-bold">{meta ? jalaliDate(meta.updatedAt) : '—'}</p>
            </div>
            <div>
              <p className="text-muted">فضای مصرفی</p>
              <p className="font-bold">
                {usage.usage ? formatBytes(usage.usage) : '—'}
                {usage.persisted && <span className="ms-1 text-[11px] font-normal text-ok">(ماندگار)</span>}
              </p>
            </div>
          </div>
          <Row
            label={<span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> بررسی به‌روزرسانی</span>}
            hint={data.lastCheck ? `آخرین بررسی: ${relativeTime(data.lastCheck)}` : 'دریافت فقط تغییرات (JSON Patch)'}
            onClick={async () => {
              if (!navigator.onLine) {
                const ok = await requestBackgroundUpdate()
                toast(ok ? 'به‌محض اتصال به اینترنت، به‌روزرسانی در پس‌زمینه انجام می‌شود.' : 'اتصال اینترنت برقرار نیست.')
                return
              }
              await refreshData()
            }}
          />
          <Row label="به‌روزرسانی خودکار" hint="بررسی نسخه جدید هنگام باز شدن اپ و به‌صورت هفتگی در پس‌زمینه">
            <Switch checked={s.autoUpdate} onChange={(v) => updateSettings({ autoUpdate: v })} label="به‌روزرسانی خودکار" />
          </Row>
          <Row label="دریافت مجدد کامل داده‌ها" hint="در صورت بروز خطا در داده‌ها" onClick={() => void reinstall()} />
          <QIndexOfflineRow />
        </Section>

        <Section title="اعلان‌ها" icon={<Bell className="h-4 w-4" />}>
          <Row label="اعلان تغییر مواد نشان‌شده" hint="پس از هر به‌روزرسانی، اگر ماده‌ای که نشان کرده‌اید تغییر کند">
            <Switch checked={s.notifyBookmarkChanges} onChange={(v) => updateSettings({ notifyBookmarkChanges: v })} label="اعلان تغییرات" />
          </Row>
          {perm !== 'unsupported' && perm !== 'granted' && (
            <Row label="اجازه نمایش اعلان" hint={perm === 'denied' ? 'در تنظیمات مرورگر مسدود شده است' : 'برای اعلان‌های سیستمی'} onClick={perm === 'denied' ? undefined : askNotify}>
              {perm === 'denied' ? <span className="text-[12px] text-danger">مسدود</span> : undefined}
            </Row>
          )}
        </Section>

        <Section title="نصب اپلیکیشن" icon={<Smartphone className="h-4 w-4" />}>
          {installed ? (
            <Row label="اپلیکیشن نصب شده است" hint="از صفحه اصلی دستگاه اجرا می‌شود" />
          ) : (
            <Row
              label={<span className="flex items-center gap-2"><Download className="h-4 w-4" /> افزودن به صفحه اصلی</span>}
              hint="اجرای تمام‌صفحه و آفلاین مانند اپ بومی"
              onClick={async () => {
                if (await openInstallDialog()) return
                if (canPrompt) await promptInstall()
                else if (isIos()) setIosOpen(true)
                else toast('از منوی مرورگر گزینه «نصب برنامه» یا «Add to Home screen» را انتخاب کنید.')
              }}
            />
          )}
        </Section>

        <Section title="حریم خصوصی و پشتیبان" icon={<ShieldCheck className="h-4 w-4" />}>
          <p className="px-4 py-3 text-[12.5px] leading-6 text-muted">
            نشان‌ها، یادداشت‌ها و تاریخچه فقط در همین دستگاه (IndexedDB) ذخیره می‌شوند و به هیچ سروری ارسال نمی‌شوند. این اپ هیچ ابزار ردیابی یا آماری ندارد.
          </p>
          <Row label={<span className="flex items-center gap-2"><FileDown className="h-4 w-4" /> خروجی پشتیبان (JSON)</span>} onClick={() => void exportData()} />
          <Row label={<span className="flex items-center gap-2"><FileUp className="h-4 w-4" /> بازیابی از فایل پشتیبان</span>} onClick={() => fileRef.current?.click()} />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importData(f)
              e.target.value = ''
            }}
          />
          <div className="px-4 py-3.5">
            {confirmWipe ? (
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" onClick={() => void wipePersonal()}>
                  بله، همه پاک شود
                </Button>
                <Button variant="secondary" onClick={() => setConfirmWipe(false)}>
                  انصراف
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmWipe(true)} className="flex items-center gap-2 text-[14.5px] font-medium text-danger">
                <Trash2 className="h-4 w-4" /> پاک کردن همه داده‌های شخصی
              </button>
            )}
          </div>
        </Section>

        <Section title="درباره ما" icon={<Info className="h-4 w-4" />}>
          <Link to="/about" className="flex items-center gap-3 px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium">درباره ما، منابع و پوشش قوانین</span>
              <span className="block text-[12px] text-muted">جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه • توسعه: کارن سافت</span>
            </span>
            <ChevronLeft className="h-4.5 w-4.5 text-muted" />
          </Link>
          <Link to="/tools" className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex flex-1 items-center gap-2 text-[14.5px] font-medium">
              <Calculator className="h-4 w-4" /> ابزارها (ارث، دیه، QR)
            </span>
            <ChevronLeft className="h-4.5 w-4.5 text-muted" />
          </Link>
          <p className="px-4 py-3 text-[12px] text-muted">کتابچه قانون — نسخه اپ {toFaDigits(__APP_VERSION__)}</p>
        </Section>

        <Disclaimer />
      </main>

      <Sheet open={readerOpen} onClose={() => setReaderOpen(false)} title="تنظیمات مطالعه">
        <ReaderSettings />
      </Sheet>
      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </div>
  )
}
