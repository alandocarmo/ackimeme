/** @type {import('next').NextConfig} */
const nextConfig = {
  // Garante que a variável de ambiente esteja disponível no build da Vercel
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_NETWORK_LABEL: process.env.NEXT_PUBLIC_NETWORK_LABEL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  // Next.js 14: remotePatterns substitui domains (deprecated)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ackimeme.fun" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "arweave.net" },
    ],
    unoptimized: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // X-Frame-Options removido — conflita com frame-ancestors CSP e
          // bloqueia o Telegram WebApp (iframe). O CSP abaixo define a política.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""} https://va.vercel-scripts.com https://telegram.org`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://gateway.pinata.cloud https://ipfs.io https://cloudflare-ipfs.com https://arweave.net",
              "connect-src 'self' https://shellnet.ackinacki.org https://mainnet.ackinacki.org https://api.pinata.cloud https://api.ackimeme.fun https://va.vercel-scripts.com http://localhost:*",
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
