/** @type {import('next').NextConfig} */
const nextConfig = {
  // خروجی استاتیک برای GitHub Pages
  output: 'export',

  // نام مخزن GitHub (در آدرس https://rahmaniho.github.io/Lawbook/)
  basePath: '/Lawbook',
  assetPrefix: '/Lawbook/',

  // برای اینکه تصاویر next/image در حالت استاتیک کار کنند
  images: {
    unoptimized: true,
  },

  // اضافه کردن اسلش انتهایی به مسیرها (برای سازگاری با GitHub Pages)
  trailingSlash: true,

  // غیرفعال کردن بهینه‌سازی‌های سمت سرور (در حالت export لازم است)
  reactStrictMode: true,
  swcMinify: true,

  // اگر از rewrites/redirects استفاده می‌کردید، در حالت export پشتیبانی نمی‌شوند
  // پس این بخش‌ها را حذف کنید یا به _redirects منتقل کنید
};

module.exports = nextConfig;
