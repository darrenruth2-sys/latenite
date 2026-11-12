import type { NextConfig } from 'next';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const ws = supabase.replace(/^http/, 'ws');
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${supabase}`,
  `media-src 'self' blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${ws}`,
  'frame-src https://challenges.cloudflare.com https://www.gofundme.com https://open.spotify.com https://www.youtube-nocookie.com https://embed.music.apple.com https://w.soundcloud.com',
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    }];
  },
};
export default nextConfig;
