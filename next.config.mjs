/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // اپ موبایل‌فرست؛ هیچ تصویر خارجی/ریموتی بارگذاری نمی‌شود (شرط کارکرد آفلاین)
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const immutable = 'public, max-age=31536000, immutable';
    const rev = 'public, max-age=0, must-revalidate';
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      { source: '/manifest.webmanifest', headers: [{ key: 'Cache-Control', value: rev }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: immutable }] },
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: immutable }] },
      {
        source: '/data/version.json',
        headers: [{ key: 'Cache-Control', value: rev }],
      },
      {
        source: '/data/:version/laws/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
