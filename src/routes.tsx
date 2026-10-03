import type { RouteObject } from 'react-router'
import { RootLayout } from './RootLayout'
import HomePage from './pages/HomePage'
import { RouteError } from './pages/RouteError'

const lazy = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

/** مسیرها — صفحات به‌جز خانه به‌صورت تنبل (code-splitting) بارگذاری می‌شوند */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'laws', lazy: lazy(() => import('./pages/LawsPage')) },
      { path: 'law/:lawId', lazy: lazy(() => import('./pages/LawPage')) },
      { path: 'law/:lawId/:key', lazy: lazy(() => import('./pages/ArticlePage')) },
      { path: 'search', lazy: lazy(() => import('./pages/SearchPage')) },
      { path: 'bookmarks', lazy: lazy(() => import('./pages/BookmarksPage')) },
      { path: 'settings', lazy: lazy(() => import('./pages/SettingsPage')) },
      { path: 'tools', lazy: lazy(() => import('./pages/ToolsPage')) },
      { path: 'tools/inheritance', lazy: lazy(() => import('./pages/InheritancePage')) },
      { path: 'tools/diyeh', lazy: lazy(() => import('./pages/DiyehPage')) },
      { path: 'tools/scan', lazy: lazy(() => import('./pages/ScanPage')) },
      { path: 'about', lazy: lazy(() => import('./pages/AboutPage')) },
      { path: '*', lazy: lazy(() => import('./pages/NotFoundPage')) },
    ],
  },
]
