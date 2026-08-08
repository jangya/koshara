import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@astryxdesign/core', 'lucide-react'],
    serverActions: {bodySizeLimit: '11mb'},
    proxyClientMaxBodySize: 11 * 1024 * 1024,
  },
  transpilePackages: ['@koshara/domain', '@koshara/database', '@koshara/ui'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
          {key: 'X-Content-Type-Options', value: 'nosniff'},
          {key: 'X-Frame-Options', value: 'DENY'},
          {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'},
          {key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload'},
        ],
      },
    ];
  },
};

export default nextConfig;
