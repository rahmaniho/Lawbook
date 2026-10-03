import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/** پیش‌بارگذاری فایل قلم فارسی اصلی برای جلوگیری از جابه‌جایی چیدمان (CLS) هنگام تعویض قلم */
function preloadPersianFont(): Plugin {
  return {
    name: 'preload-persian-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((f) => /vazirmatn-arabic-wght-normal.*\.woff2$/.test(f))
        if (!font) return html
        return html.replace('</title>', `</title>\n    <link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />`)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preloadPersianFont(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'کتابچه قانون ایران',
        short_name: 'کتابچه قانون',
        description: 'مرور و جستجوی آفلاین قوانین جمهوری اسلامی ایران؛ قانون اساسی، مدنی، مجازات، آیین دادرسی، تجارت، کار و …',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        lang: 'fa',
        dir: 'rtl',
        categories: ['education', 'reference', 'productivity'],
        prefer_related_applications: false,
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'جستجوی قوانین', short_name: 'جستجو', url: '/search', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
          { name: 'نشان‌شده‌ها', short_name: 'نشان‌ها', url: '/bookmarks', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
          { name: 'قانون اساسی', short_name: 'قانون اساسی', url: '/law/constitution', icons: [{ src: '/icons/192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        // داده‌های قوانین (public/data) در زمان اجرا دانلود و در IndexedDB/Cache ذخیره می‌شوند
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['data/**', '**/noto-naskh-*'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 300,
  },
  worker: {
    format: 'es',
  },
})
