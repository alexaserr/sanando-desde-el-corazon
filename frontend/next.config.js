/** @type {import('next').NextConfig} */
const nextConfig = {
  // Requerido para el Dockerfile multi-stage (genera server.js standalone)
  output: "standalone",

  // Variables de entorno expuestas al cliente — sin secretos aquí
  env: {
    NEXT_PUBLIC_CLINICAL_API_URL: process.env.NEXT_PUBLIC_CLINICAL_API_URL,
    NEXT_PUBLIC_PORTAL_API_URL: process.env.NEXT_PUBLIC_PORTAL_API_URL,
    NEXT_PUBLIC_PODCAST_API_URL: process.env.NEXT_PUBLIC_PODCAST_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  // Proxy de API en desarrollo — evita CORS localmente
  async rewrites() {
    return [
      {
        source: "/api/clinical/:path*",
        destination: `${process.env.NEXT_PUBLIC_CLINICAL_API_URL}/:path*`,
      },
      {
        source: "/api/portal/:path*",
        destination: `${process.env.NEXT_PUBLIC_PORTAL_API_URL}/:path*`,
      },
      {
        source: "/api/podcast/:path*",
        destination: `${process.env.NEXT_PUBLIC_PODCAST_API_URL}/:path*`,
      },
    ];
  },

  // Seguridad: cabeceras HTTP
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
