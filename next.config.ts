import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Elimina las llamadas a console.* en el build de producción.
    // Conserva console.error y console.warn para diagnóstico.
    // En desarrollo se mantienen todos los logs.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // Recharts y lucide-react exponen muchos módulos; el tree-shaking por import
  // reduce el tamaño del bundle de los dashboards.
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
};

export default nextConfig;
