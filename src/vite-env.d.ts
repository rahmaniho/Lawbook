/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** کلید عمومی VAPID برای اعلان‌های Push (اختیاری) */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** آدرس API ثبت اشتراک Push (اختیاری) */
  readonly VITE_PUSH_SUBSCRIBE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}

interface Navigator {
  standalone?: boolean
}

interface BarcodeDetectorResult {
  rawValue: string
  format: string
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  static getSupportedFormats(): Promise<string[]>
  detect(source: CanvasImageSource | ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}
