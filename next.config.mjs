/** @type {import('next').NextConfig } */
const isVercel = process.env.VERCEL === '1';
// پیش‌فرض «/Lawbook» برای استقرار روی GitHub Pages است؛
// برای اجرای محلی در ریشه: NEXT_PUBLIC_BASE_PATH= VERCEL=1 npm run dev
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/Lawbook';

const nextConfig = {
  // GitHub Pages needs a static export, while Vercel should use its native Next.js output.
  ...(isVercel ? {} : { output: 'export' }),
  ...(isVercel ? {} : { basePath, assetPrefix: basePath ? `${basePath}/` : '' }),

  images: {
    unoptimized: true,
  },

  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
