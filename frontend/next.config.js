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
        source: "/api/v1/:path*",
        destination: `${process.env.CLINICAL_API_INTERNAL_URL || "http://clinical-api:8001"}/api/v1/:path*`,
      },
      {
        source: "/api/clinical/:path*",
        destination: `${process.env.CLINICAL_API_INTERNAL_URL || "http://clinical-api:8001"}/:path*`,
      },
      {
        source: "/api/portal/:path*",
        destination: `${process.env.PORTAL_API_INTERNAL_URL || "http://portal-api:8002"}/:path*`,
      },
      {
        source: "/api/podcast/:path*",
        destination: `${process.env.PODCAST_API_INTERNAL_URL || "http://podcast-api:8003"}/:path*`,
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
