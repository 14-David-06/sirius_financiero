/**
 * 🔒 CONFIGURACIÓN DE SEGURIDAD PARA NEXT.JS
 * Configuración de headers y políticas de seguridad
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración de headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store'
          }
        ]
      }
    ];
  },

  // Redirecciones de seguridad
  async redirects() {
    return [
      {
        source: '/.env.local',
        destination: '/404',
        permanent: true
      },
      {
        source: '/.env',
        destination: '/404', 
        permanent: true
      },
      {
        source: '/config.json',
        destination: '/404',
        permanent: true
      }
    ];
  },

  // Configuración de imágenes segura
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/dvnuttrox/**'
      }
    ],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },

  // Configuración de compilación
  experimental: {
    serverComponentsExternalPackages: []
  },

  // Configurar CSP
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
        has: [
          {
            type: 'header',
            key: 'content-type',
            value: 'application/json'
          }
        ]
      }
    ];
  }
};

// Configuración de Content Security Policy
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.airtable.com https://telegram-apps-u38879.vm.elestio.app;
  media-src 'self' blob:;
  worker-src 'self' blob:;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://telegram-apps-u38879.vm.elestio.app;
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

module.exports = nextConfig;
