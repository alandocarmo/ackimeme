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
    unoptimized: true, // necessário para export estático se for usar
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
