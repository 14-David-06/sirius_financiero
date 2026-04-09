# CLAUDE.md — Sirius Financiero

> Archivo leído automáticamente por Claude Code CLI en cada sesión. Documenta el proyecto para todos los agentes de desarrollo.

## Stack Tecnológico

- **Framework**: Next.js 15.4.8 con App Router (monorepo — sin separación backend/frontend)
- **React**: 19.1.2
- **TypeScript**: 5.x (strict mode)
- **Estilos**: Tailwind CSS 4 con PostCSS, glass-morphism UI (degradado azul-púrpura)
- **Base de datos**: Airtable (3 bases: Financiera, Nomina Core, Insumos Core)
- **AI**: OpenAI API (GPT-4o-mini para agentes, Whisper-1 para transcripción)
- **Auth**: JWT custom (jsonwebtoken), bcryptjs para hashing
- **Cloud**: AWS S3 (documentos), OneDrive/Microsoft Graph (facturas)
- **Integración**: n8n webhooks para procesamiento automático de facturas
- **Charts**: Recharts para visualizaciones

## Estructura del Monorepo

```
src/
├── app/
│   ├── api/                    # Backend — Route handlers (Next.js App Router)
│   │   ├── authenticate/       # Login: cédula + password → JWT
│   │   ├── check-session/      # Validar sesión activa
│   │   ├── logout/             # Cerrar sesión
│   │   ├── setup-password/     # Configurar password inicial
│   │   ├── validate-user/      # Validar usuario existente
│   │   │
│   │   ├── compras/            # CRUD solicitudes de compra
│   │   ├── solicitudes-compra/ # Crear nueva solicitud
│   │   ├── cotizaciones/       # Guardar/extraer cotizaciones
│   │   ├── proveedores/        # Base de proveedores
│   │   ├── catalogo-insumos/   # Catálogo de insumos
│   │   ├── items/              # Items de solicitudes
│   │   ├── generate-orden-compra/
│   │   │
│   │   ├── caja-menor/         # CRUD caja menor
│   │   ├── caja-menor-agent/   # Agente IA GPT-4o-mini
│   │   ├── caja-menor-analisis/
│   │   ├── consolidar-caja-menor/
│   │   │
│   │   ├── facturacion-ingresos/
│   │   ├── facturacion-egresos-callback/   # Webhook n8n
│   │   ├── facturacion-stream/             # SSE streaming
│   │   ├── monitoreo-facturas/
│   │   │
│   │   ├── movimientos-bancarios/          # Multi-banco
│   │   ├── movimientos-bancarios-bancolombia/
│   │   ├── movimientos-bancarios-bbva/
│   │   │
│   │   ├── proyecciones/       # Simulaciones financieras
│   │   ├── indicadores-produccion/
│   │   ├── balances-masa/      # Pirolisis
│   │   ├── centralizacion-general/
│   │   │
│   │   ├── chat-compras/       # Chat en tiempo real
│   │   ├── transcribe-audio/   # Whisper transcripción
│   │   ├── clasificar-item-ia/ # Clasificación automática
│   │   │
│   │   ├── upload-onedrive/    # Microsoft Graph API
│   │   ├── upload-file/        # AWS S3
│   │   ├── upload-factura-onedrive/
│   │   │
│   │   ├── warehouse/          # Recepción de almacén
│   │   │   ├── ordenes-pendientes/  # GET OCs pendientes
│   │   │   ├── recepciones/    # POST crear recepción completa
│   │   │   └── movimientos/    # GET/POST movimientos inventario
│   │   │       ├── [id]/
│   │   │       │   ├── confirmar/   # PATCH confirmar ingreso
│   │   │       │   └── rechazar/    # PATCH rechazar ingreso
│   │   │
│   │   ├── ordenes-compra/     # Gestión de OCs
│   │   │   ├── route.ts        # GET listar OCs
│   │   │   └── [id]/
│   │   │       ├── estado/     # PATCH actualizar estado
│   │   │       └── pdf/        # GET generar PDF
│   │
│   ├── solicitudes-compra/     # Frontend — Páginas
│   ├── monitoreo-solicitudes/
│   ├── mis-solicitudes-compras/
│   ├── caja-menor/
│   ├── movimientos-bancarios/
│   ├── facturacion-ingresos/
│   ├── facturacion-egresos/
│   ├── resumen-gerencial/
│   ├── indicadores-produccion/
│   ├── simulador-proyecciones/
│   ├── monitoreo-facturas/
│   ├── flujo-caja/
│   ├── analisis-rentabilidad/
│   ├── recepcion-almacen/      # Recepción de mercancía (warehouse)
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Tailwind 4
│
├── components/                 # Componentes React
│   ├── SolicitudesCompra.tsx   # Crear solicitud + audio
│   ├── MisSolicitudesCompras.tsx
│   ├── MonitoreoSolicitudes.tsx
│   ├── DashboardCompras.tsx    # Panel admin compras
│   ├── CajaMenor.tsx           # Gestión caja menor
│   ├── CajaMenorAgent.tsx      # Chat IA + voz
│   ├── ScannerComprobante.tsx  # Escaneo de imágenes → PDF (client-side)
│   ├── FacturacionIngresos.tsx
│   ├── FacturacionEgresos.tsx
│   ├── MovimientosBancarios.tsx
│   ├── ResumenGerencial.tsx    # Dashboard KPIs
│   ├── IndicadoresProduccion.tsx
│   ├── SimuladorProyecciones.tsx
│   ├── MonitoreoFacturas.tsx
│   ├── ChatCompra.tsx          # Chat solicitudes
│   ├── RecepcionAlmacen.tsx    # Recepción de mercancía warehouse
│   ├── LoginComponent.tsx      # Login multi-step
│   ├── RoleGuard.tsx           # Control de acceso
│   ├── layout/
│   │   ├── Navbar.tsx          # Navegación principal
│   │   └── Footer.tsx
│   └── ui/
│       ├── Button.tsx          # Variantes: primary, secondary, outline
│       ├── Card.tsx            # Glass-morphism cards
│       └── Toast.tsx           # Notificaciones
│
├── lib/
│   ├── airtable.ts             # Conexión base Airtable
│   ├── security.ts             # Rate limiting, sanitización
│   ├── stream-manager.ts       # Manejo de SSE streams
│   ├── config/
│   │   └── airtable-fields.ts  # Mapeo dinámico de campos
│   ├── hooks/
│   │   ├── useAuthSession.ts   # Manejo de sesión
│   │   ├── useNotifications.ts # Notificaciones push + toast
│   │   └── useMessagePolling.ts # Polling de mensajes
│   ├── utils/
│   └── security/
│
├── types/
│   ├── compras.ts              # Tipos de compras, items, cotizaciones
│   └── speech-recognition.ts   # Web Speech API types
│
└── middleware.ts               # JWT verification + RBAC
```

## Convenciones

- **Idioma**: Español colombiano en UI, comentarios y mensajes de agentes
- **Path alias**: `@/*` → `./src/*`
- **API pattern**: GET/POST/PUT/DELETE en un solo `route.ts` por recurso
- **Auth**: Cookie `auth-token` (24h), middleware verifica JWT
- **RBAC**: 4 categorías — Desarrollador > Gerencia > Administrador > Colaborador
- **Tables Airtable**: Nombres de campos en variables de entorno (no hardcoded)
- **SSE streaming**: `text/event-stream` para facturación y procesos largos
- **Seguridad**: Sanitización de inputs, rate limiting, headers de seguridad

## Funcionalidades Destacadas

### Escaneo de Comprobantes (Caja Menor)
El formulario de registro de gastos de caja menor incluye un scanner integrado:
- **Captura:** Toma fotos con la cámara del dispositivo o sube desde galería
- **Procesamiento:** Mejora de contraste automática usando Canvas API
- **PDF:** Generación client-side con pdf-lib (sin servicios externos)
- **Multipágina:** Soporte para múltiples imágenes en un solo PDF
- **Almacenamiento:** Upload a S3 y guardado en Airtable campo `Comprobante`
- **Componente:** `ScannerComprobante.tsx` (reutilizable)

Flujo: Captura imagen → Mejora contraste → Genera PDF → Sube a S3 → Guarda en Airtable

## Patrones Clave del Código

### Autenticación JWT
```typescript
// middleware.ts
const token = request.cookies.get('auth-token')?.value;
const decoded = jwt.verify(token, JWT_SECRET) as {
  cedula: string;
  nombre: string;
  categoria: 'Colaborador' | 'Administrador' | 'Gerencia' | 'Desarrollador';
};
```

### Verificación de Roles
```typescript
// RoleGuard.tsx - Control de acceso por categoría
const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador'];
if (!allowedCategories.includes(decoded.categoria)) {
  return NextResponse.redirect(new URL('/', request.url));
}
```

### Conexión Airtable (Multi-Base)
```typescript
// Base Financiera Principal
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

// Base Nomina Core (Autenticación)
// Usa NOMINA_AIRTABLE_API_KEY si existe, sino usa AIRTABLE_API_KEY
const nominaKey = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
const nominaBase = new Airtable({ apiKey: nominaKey })
  .base(process.env.NOMINA_AIRTABLE_BASE_ID);

// Base Insumos Core (Inventario)
const insumosBase = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY })
  .base(process.env.AIRTABLE_INS_BASE_ID);
```

### Rate Limiting
```typescript
// src/lib/security.ts
SecurityMiddleware.checkRateLimit(request); // 10 req/60s
```

### SSE Streaming Pattern
```typescript
// Para procesos largos (facturación, IA)
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  },
});
```

### Hook de Sesión
```typescript
// src/lib/hooks/useAuthSession.ts
const { isAuthenticated, userData, login, logout } = useAuthSession();
```

## Tablas Airtable Principales

| Tabla | Variable de Entorno | Propósito |
|-------|-------------------|----------|
| Equipo Financiero | AIRTABLE_TEAM_TABLE_NAME | Usuarios y autenticación |
| Compras y Adquisiciones | AIRTABLE_COMPRAS_TABLE_ID | Solicitudes de compra |
| Items | AIRTABLE_ITEMS_TABLE_ID | Items de cada solicitud |
| Cotizaciones | AIRTABLE_COTIZACIONES_TABLE_ID | Propuestas de proveedores |
| Items Cotizados | AIRTABLE_ITEMS_COTIZADOS_TABLE_ID | Detalle de cotizaciones |
| Caja Menor | CAJA_MENOR_TABLE_ID | Anticipos mensuales |
| Items Caja Menor | ITEMS_CAJA_MENOR_TABLE_ID | Gastos individuales |
| Movimientos Bancarios | AIRTABLE_MOVIMIENTOS_TABLE_ID | Transacciones bancarias |
| Facturación Ingresos | AIRTABLE_INGRESOS_TABLE_ID | Ventas/Ingresos |
| Conversaciones | AIRTABLE_CONVERSACIONES_TABLE_ID | Chat solicitudes |
| Proveedores | AIRTABLE_PROVEEDORES_TABLE_ID | Base de proveedores |
| Proyecciones | AIRTABLE_PROYECCIONES_TABLE_ID | Simulaciones financieras |
| Órdenes de Compra | AIRTABLE_ORDENES_COMPRA_TABLE_ID | Órdenes generadas desde cotizaciones |
| Items OC | AIRTABLE_ITEMS_OC_TABLE_ID | Ítems de órdenes de compra |
| Recepciones Almacén | AIRTABLE_WAREHOUSE_RECEIPTS_TABLE_ID | Registro de recepciones de mercancía |
| Items Recepción | AIRTABLE_WAREHOUSE_RECEIPT_ITEMS_TABLE_ID | Ítems recibidos por recepción |

### Tablas de Inventario (Sirius Insumos Core)

| Tabla | Variable de Entorno | Propósito |
|-------|-------------------|----------|
| Insumo | AIRTABLE_INS_TABLE_ID | Catálogo de insumos |
| Movimientos Insumos | AIRTABLE_MOV_INSUMO_TABLE_ID | Ingresos/Salidas de inventario |
| Stock Insumos | AIRTABLE_STOCK_INSUMO_TABLE_ID | Stock actual por área |
| Categorías Insumo | AIRTABLE_CAT_INSUMO_TABLE_ID | Categorías de insumos |
| Unidades | AIRTABLE_UNIDADES_TABLE_ID | Unidades de medida |
| Áreas | AIRTABLE_AREAS_TABLE_ID | Áreas de almacenamiento |

## Módulo Warehouse (Recepción de Almacén)

### Flujo Completo

1. **Cotización aprobada** → OC generada (generate-orden-compra)
2. **Almacenista** → Recibe mercancía física y registra en `/recepcion-almacen`
   - Por cada ítem: cantidad recibida, área destino, diferencias
   - Crea registros en "Recepciones Almacén" e "Items Recepción"
   - Crea movimientos en estado "En Espera"
3. **Supervisor** → Confirma/Rechaza movimientos
   - Confirmar → Stock se actualiza en área destino
   - Rechazar → Movimiento marcado "Rechazado", stock NO se toca
4. **Sistema** → Actualiza estado de OC según recepciones

### Endpoints Warehouse

```typescript
// Listar OCs pendientes de recepción
GET /api/warehouse/ordenes-pendientes

// Crear recepción completa
POST /api/warehouse/recepciones
{
  ordenCompraId: string,
  items: [{ itemOCId, insumoId, areaDestinoId, cantidadPedida, cantidadRecibida, notaDiferencia }],
  notasGenerales?: string
}

// Listar movimientos en espera
GET /api/warehouse/movimientos

// Confirmar ingreso al inventario
PATCH /api/warehouse/movimientos/[id]/confirmar
{ confirmarMovimiento: true, observacionesFinales?: string }

// Rechazar ingreso
PATCH /api/warehouse/movimientos/[id]/rechazar
{ motivoRechazo: string }
```

### Control de Acceso Warehouse

Roles autorizados (definidos en WAREHOUSE_ALLOWED_ROLES):
- Super Admin: DIRECTOR EJECUTIVO, CTO, DIRECTOR FINANCIERO, COORDINADORA LIDER, INGENIERO DE DESARROLLO
- Admin Depto: JEFE DE PLANTA, JEFE DE PRODUCCION, SUPERVISOR DE PRODUCCION
- Nivel Avanzado: CONTADORA, ASISTENTE FINANCIERO Y CONTABLE

Rutas protegidas: `/recepcion-almacen`, `/warehouse`

## Integraciones Externas

### Microsoft OneDrive (Graph API)
```
Credenciales: ADM_MICROSOFT_CLIENT_ID, ADM_MICROSOFT_CLIENT_SECRET, ADM_MICROSOFT_TENANT_ID
Uso: Almacenamiento de facturas y documentos
Rutas: /General/Documentos Soporte/{año}/Movimientos {banco}/
```

### AWS S3
```
Credenciales: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
Uso: PDFs de caja menor, documentos consolidados
```

### OpenAI
```
Credencial: OPENAI_API_KEY
Modelos: GPT-4o-mini (caja-menor-agent), Whisper-1 (transcribe-audio)
```

### n8n Webhooks
```
Flujo: PDF en OneDrive → Webhook n8n → OCR/AI → Callback API
Endpoints: /api/facturacion-callback, /api/facturacion-stream
```

## Comandos de Desarrollo

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
npm run lint      # ESLint
npm run security:check   # Verificar seguridad
npm run security:clean   # Limpiar logs sensibles
```
