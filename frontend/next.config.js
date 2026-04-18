/** @type {import('next').NextConfig} */
const nextConfig = {
  // Garante que a variável de ambiente esteja disponível no build da Vercel
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_NETWORK_LABEL: process.env.NEXT_PUBLIC_NETWORK_LABEL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  // Domínios permitidos para carregamento de imagens externas (logo, cover)
  images: {
    domains: [
      "ackimeme.fun",
      "ipfs.io",
      "cloudflare-ipfs.com",
      "gateway.pinata.cloud",
      "arweave.net",
    ],
    unoptimized: false, // Issue #35: Imagens agora são otimizadas nativamente no server
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
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://gateway.pinata.cloud https://ipfs.io https://cloudflare-ipfs.com https://arweave.net",
              "connect-src 'self' https://shellnet.ackinacki.org https://api.pinata.cloud https://api.ackimeme.fun https://va.vercel-scripts.com http://localhost:*",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
