import { StrictMode, startTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { applySettings } from './lib/settings'
import { routes } from './routes'

applySettings()

const router = createBrowserRouter(routes)
const root = createRoot(document.getElementById('root')!)

// رندر اولیه به‌صورت transition (قابل‌تقسیم): React هر چند میلی‌ثانیه کنترل را به مرورگر برمی‌گرداند،
// پس رندر نخستین صفحه به وظایف بلند (long task) تبدیل نمی‌شود و رشته اصلی پاسخ‌گو می‌ماند.
startTransition(() => {
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
})
