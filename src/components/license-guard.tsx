'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { db } from '@/lib/db';

export const LICENSED_DEPLOYMENT = process.env.NEXT_PUBLIC_LICENSED_DEPLOYMENT === '1';

/** UX guard only. PHP must authorize EVERY HTML, JS, RSC and data request. */
export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(!LICENSED_DEPLOYMENT);
  const path = usePathname();
  useEffect(() => {
    if (!LICENSED_DEPLOYMENT) return;
    setAllowed(false);
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const check = async () => {
      if (running || disposed) return;
      running = true;
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const result = await fetch('/index.php?page=status', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        const status = result.ok ? await result.json() : null;
        if (!status || status.active !== true) throw new Error('Subscription unavailable');
        if (!disposed) setAllowed(true);
      } catch {
        if (disposed) return;
        setAllowed(false);
        // Purge paid corpus, not personal bookmarks and notes. Best-effort only:
        // no web application can revoke copies already saved by an authorized user.
        try { await Promise.all([db.articles.clear(), db.laws.clear(), db.meta.clear(), db.cases.clear(), db.caseIndex.clear()]); } catch { /* Navigation must still lock access. */ }
        if (!disposed) window.location.replace('/index.php?page=subscribe');
      } finally {
        clearTimeout(timer);
        running = false;
      }
    };
    void check();
    const interval = setInterval(() => { void check(); }, 60000);
    const focus = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', focus);
    // Licensed installation uses a new /app scope; offline delivery is disabled.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          if ('/app/'.startsWith(new URL(registration.scope).pathname)) void registration.unregister();
        }
      }).catch(() => undefined);
    }
    return () => { disposed = true; controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', focus); };
  }, [path]);

  if (!allowed) return <div role="status" className="app-container py-10 text-center">در حال بررسی اشتراک… برای نسخه اشتراکی اتصال اینترنت لازم است.</div>;
  return <>{LICENSED_DEPLOYMENT && <div className="bg-primary px-4 py-2 text-center text-xs text-primary-foreground"><a href="/index.php?page=subscribe" className="underline">وضعیت و تمدید اشتراک</a><span> — نسخه آنلاین اشتراکی</span></div>}{children}</>;
}
