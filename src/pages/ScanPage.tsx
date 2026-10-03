import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Camera, QrCode, AlertTriangle } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

/** اسکن QR با BarcodeDetector (کروم/اج اندروید)؛ پیوند مواد اپ را مستقیماً باز می‌کند */
export default function ScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'idle' | 'scanning' | 'unsupported' | 'denied' | 'found'>('idle')
  const [value, setValue] = useState('')
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!supported) setState('unsupported')
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [supported])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setState('scanning')
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      const tick = async () => {
        if (!streamRef.current) return
        try {
          const codes = await detector.detect(video)
          if (codes.length) {
            const raw = codes[0].rawValue
            setValue(raw)
            setState('found')
            stream.getTracks().forEach((t) => t.stop())
            streamRef.current = null
            try {
              const url = new URL(raw, location.origin)
              if (url.origin === location.origin && url.pathname.startsWith('/law/')) navigate(url.pathname)
            } catch {
              /* متن غیرپیوند */
            }
            return
          }
        } catch {
          /* ادامه */
        }
        requestAnimationFrame(() => void tick())
      }
      void tick()
    } catch {
      setState('denied')
    }
  }

  return (
    <div className="pb-2">
      <AppBar back="/tools" title="اسکن QR ماده" />
      <main className="mx-auto max-w-md px-4 pt-4">
        {state === 'unsupported' ? (
          <EmptyState
            icon={<QrCode className="h-7 w-7" />}
            title="مرورگر شما از اسکن داخلی پشتیبانی نمی‌کند"
            description="QR کد ماده را با دوربین گوشی اسکن کنید؛ پیوند مستقیماً در «کتابچه قانون» باز می‌شود."
          />
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-card bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              {state !== 'scanning' && (
                <div className="absolute inset-0 grid place-items-center text-white/80">
                  <Camera className="h-12 w-12" />
                </div>
              )}
              {state === 'scanning' && <div className="absolute inset-10 rounded-3xl border-4 border-white/70" />}
            </div>
            {state === 'denied' && (
              <p className="flex items-center gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
                <AlertTriangle className="h-4 w-4" /> دسترسی به دوربین داده نشد.
              </p>
            )}
            {state === 'found' && (
              <p className="break-all rounded-2xl bg-surface-2 p-3 text-sm" dir="auto">
                {value}
              </p>
            )}
            {state !== 'scanning' && (
              <Button className="w-full" onClick={() => void start()}>
                <Camera className="h-4.5 w-4.5" /> شروع اسکن
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
