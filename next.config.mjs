/** @type {import('next').NextConfig } */
const isVercel = process.env.VERCEL === '1';

const nextConfig = {
  // GitHub Pages needs a static export, while Vercel should use its native Next.js output.
  ...(isVercel ? {} : { output: 'export' }),
  ...(isVercel ? {} : { basePath: '/Lawbook', assetPrefix: '/Lawbook/' }),

  images: {
    unoptimized: true,
  },

  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
