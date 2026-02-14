import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: 'next-dist',
  images: {
    // Shopify and supplier images can come from many hosts.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

export default nextConfig;
