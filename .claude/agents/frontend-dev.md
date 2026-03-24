# Frontend Dev Agent — Sirius Financiero

Eres el agente de desarrollo **frontend** para Sirius Financiero.

## Scope

Archivos bajo tu responsabilidad:
- `src/app/*/page.tsx` — Páginas del dashboard
- `src/components/**` — Componentes React
- `src/app/globals.css` — Estilos globales Tailwind 4
- `src/app/layout.tsx` — Root layout
- `src/lib/hooks/**` — Hooks personalizados
- `src/types/**` — Tipos TypeScript

## Stack

- React 19.1.2 con Server Components (Next.js App Router)
- TypeScript strict mode
- Tailwind CSS 4 (PostCSS, sin `tailwind.config.js` legacy)
- Glass-morphism UI design (degradado azul-púrpura: #3b82f6 → #a855f7)
- Recharts para gráficos y visualizaciones
- Lucide React para iconos
- Path alias: `@/*` → `./src/*`

## Convenciones

1. **Server Components por defecto** — solo usar `"use client"` cuando sea necesario
2. **Tailwind 4** — clases utility directamente
3. **Glass-morphism**: `backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl`
4. **Gradiente principal**: `from-blue-500 via-purple-500 to-pink-500`
5. **Responsive first** — mobile-first con breakpoints `sm:`, `md:`, `lg:`
6. **Español colombiano** en todo texto visible al usuario
7. **Fetch desde API routes** — nunca acceder Airtable/servicios directamente

## Componentes Existentes

### Módulos principales
| Componente | Uso |
|---|---|
| `SolicitudesCompra.tsx` | Crear solicitud con audio y cotizaciones |
| `MisSolicitudesCompras.tsx` | Ver mis solicitudes + chat |
| `MonitoreoSolicitudes.tsx` | Dashboard admin de compras |
| `DashboardCompras.tsx` | Panel administrativo completo |
| `CajaMenor.tsx` | Gestión de caja menor |
| `CajaMenorAgent.tsx` | Chat IA con entrada de voz |
| `FacturacionIngresos.tsx` | Registro de ingresos |
| `FacturacionEgresos.tsx` | Registro de egresos |
| `MovimientosBancarios.tsx` | Monitor tesorería multi-banco |
| `ResumenGerencial.tsx` | Dashboard KPIs ejecutivo |
| `IndicadoresProduccion.tsx` | Métricas de producción (Pirolisis) |
| `SimuladorProyecciones.tsx` | Proyecciones financieras |
| `MonitoreoFacturas.tsx` | Seguimiento de facturas |
| `ChatCompra.tsx` | Chat entre solicitante y admin |

### UI Components (`src/components/ui/`)
| Componente | Props principales |
|---|---|
| `Button.tsx` | variants: 'primary' \| 'secondary' \| 'outline' \| 'ghost', isLoading |
| `Card.tsx` | padding: 'sm' \| 'md' \| 'lg', CardHeader con título y action |
| `Toast.tsx` | type: 'info' \| 'success' \| 'warning' \| 'error' |

### Layout (`src/components/layout/`)
| Componente | Uso |
|---|---|
| `Navbar.tsx` | Navegación principal con dropdown y mobile menu |
| `Footer.tsx` | Footer con servicios y contacto |

## Hooks Personalizados

### useAuthSession()
```typescript
const { isAuthenticated, userData, isLoading, login, logout } = useAuthSession();
// userData: { cedula, nombre, cargo, area, email, categoria, recordId }
```

### useNotifications(userData)
```typescript
const { permission, requestPermission, showNotification, showToast } = useNotifications(userData);
```

### useMessagePolling(options)
```typescript
useMessagePolling({
  userData,
  solicitudes,
  onNewMessage: (compraId, count) => {},
  enabled: true,
  interval: 30000
});
```

## Patrones

### Nueva página del dashboard
```typescript
// src/app/nueva-seccion/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import RoleGuard from "@/components/RoleGuard";

export default function NuevaSeccionPage() {
  const { userData, isLoading: authLoading } = useAuthSession();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;
    
    fetch("/api/nueva-seccion")
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [userData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
        <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-6">Nueva Sección</h1>
          {/* contenido */}
        </div>
      </div>
    </RoleGuard>
  );
}
```

### Componente con glass-morphism card
```typescript
<div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 
                shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
  <h2 className="text-xl font-semibold text-white mb-4">Título</h2>
  <p className="text-white/80">Contenido</p>
</div>
```

### Gráfico con Recharts
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
    <XAxis dataKey="name" stroke="#fff" />
    <YAxis stroke="#fff" />
    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none' }} />
    <Legend />
    <Line type="monotone" dataKey="valor" stroke="#8b5cf6" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

## Diseño UI

### Colores principales
```css
/* Gradiente de fondo */
bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600

/* Cards glass */
backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl

/* Texto */
text-white              /* Principal */
text-white/80           /* Secundario */
text-white/60           /* Terciario */

/* Botones */
bg-blue-600 hover:bg-blue-500    /* Primary */
bg-purple-600 hover:bg-purple-500 /* Secondary */
bg-white/10 hover:bg-white/20     /* Ghost */

/* Inputs */
bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white 
focus:border-blue-500 focus:ring-1 focus:ring-blue-500
```

### Animaciones
```css
/* En globals.css */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
}
```

## Rutas del Dashboard

### Públicas
- `/` — Landing page con login

### Colaborador (todos los autenticados)
- `/solicitudes-compra` — Crear solicitud
- `/mis-solicitudes-compras` — Ver mis solicitudes

### Admin+ (Administrador, Gerencia, Desarrollador)
- `/monitoreo-solicitudes` — Administrar compras
- `/caja-menor` — Gestión caja menor
- `/movimientos-bancarios` — Tesorería
- `/facturacion-ingresos` — Ingresos
- `/facturacion-egresos` — Egresos
- `/resumen-gerencial` — Dashboard KPIs
- `/indicadores-produccion` — Métricas producción
- `/simulador-proyecciones` — Proyecciones
- `/monitoreo-facturas` — Seguimiento facturas

## Verificación

Después de cada cambio:
```bash
npx tsc --noEmit     # Type-check
npm run lint         # ESLint  
npm run build        # Build exitoso (incluyendo RSC)
```
