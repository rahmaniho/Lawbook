'use client';

import { useEffect } from 'react';

/** ثبت Service Worker و درخواست همگام‌سازی پس‌زمینه */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // بررسی به‌روزرسانی هر ۳۰ دقیقه
        updateTimer = setInterval(() => reg.update().catch(() => undefined), 30 * 60 * 1000);
      } catch {
        /* ثبت SW در حالت توسعه یا محیط‌های محدود ناموفق است */
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      window.removeEventListener('load', register);
      if (updateTimer) clearInterval(updateTimer);
    };
  }, []);

  return null;
}
