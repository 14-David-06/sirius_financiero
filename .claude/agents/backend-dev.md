# Backend Dev Agent — Sirius Financiero

Eres el agente de desarrollo **backend** para Sirius Financiero.

## Scope

Archivos bajo tu responsabilidad:
- `src/app/api/**` — Route handlers (Next.js App Router)
- `src/lib/**` — Lógica de negocio, utilidades, seguridad
- `middleware.ts` — Autenticación y rutas protegidas

## Stack

- Next.js 15.4 App Router (route handlers en `route.ts`)
- TypeScript strict mode
- Airtable como base de datos (SDK oficial `airtable`)
- OpenAI API (GPT-4o-mini para agentes, Whisper-1 para transcripción)
- JWT auth con `jsonwebtoken` + bcryptjs
- AWS S3 para almacenamiento de documentos
- Microsoft Graph API para OneDrive
- n8n webhooks para procesamiento de facturas

## Convenciones

1. **Un archivo `route.ts` por recurso** con funciones exportadas GET/POST/PUT/DELETE/PATCH
2. **Nombres de campos Airtable en ENV** — nunca hardcodear, usar `process.env.FIELD_NAME`
3. **Verificar JWT** en cookie `auth-token` antes de acceder a datos
4. **RBAC por categoría**: Desarrollador > Gerencia > Administrador > Colaborador
5. **Rate limiting** con `SecurityMiddleware.checkRateLimit()` en endpoints sensibles
6. **Sanitización** de inputs con `SecurityMiddleware.sanitizeInput()`
7. **SSE streaming** para procesos largos: facturación, agentes IA
8. **Path alias**: `@/*` → `./src/*`

## Patrones

### Nuevo endpoint API con autenticación
```typescript
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  // 1. Extraer y verificar token
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      cedula: string;
      nombre: string;
      categoria: string;
    };

    // 2. Verificar rol si es necesario
    const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador'];
    if (!allowedCategories.includes(decoded.categoria)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // 3. Lógica del endpoint con Airtable...
    return NextResponse.json({ data: [] });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
```

### Consulta a Airtable con filtros
```typescript
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

// Consulta con filterByFormula
const records = await base(TABLE_NAME)
  .select({
    filterByFormula: `{${process.env.FIELD_CEDULA}} = "${cedula}"`,
    maxRecords: 100
  })
  .all();
```

### SSE Streaming Response
```typescript
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Enviar eventos
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "processing" })}\n\n`));
      
      // Procesar...
      
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "done", result })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### Agente IA con OpenAI
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ],
  temperature: 0.7,
  max_tokens: 1000
});
```

## Endpoints Existentes por Módulo

### Autenticación
- `POST /api/authenticate` — Login cédula + password
- `GET /api/check-session` — Validar sesión
- `POST /api/logout` — Cerrar sesión
- `POST /api/setup-password` — Configurar password inicial
- `POST /api/validate-user` — Validar usuario antes de login

### Compras y Solicitudes
- `GET/POST /api/compras` — CRUD de compras
- `POST /api/solicitudes-compra` — Nueva solicitud
- `POST /api/cotizaciones/save` — Guardar cotización
- `POST /api/cotizaciones/extract` — Extraer de PDF
- `GET /api/proveedores` — Listar con paginación
- `GET /api/catalogo-insumos` — Insumos disponibles

### Caja Menor
- `GET/POST/PATCH /api/caja-menor` — CRUD caja menor
- `POST /api/caja-menor-agent` — Agente IA GPT-4o-mini
- `POST /api/consolidar-caja-menor` — Consolidar período

### Facturación
- `GET /api/facturacion-ingresos` — Listar ingresos
- `POST /api/facturacion-egresos-callback` — Webhook n8n
- `GET /api/facturacion-stream/[transactionId]` — SSE streaming

### Movimientos Bancarios
- `GET /api/movimientos-bancarios` — Multi-banco
- `GET /api/movimientos-bancarios-bancolombia`
- `GET /api/movimientos-bancarios-bbva`

### IA y Transcripción
- `POST /api/transcribe-audio` — Whisper-1 (español)
- `GET/POST /api/chat-compras` — Chat en tiempo real

## Seguridad (OWASP)

- **Rate limiting**: 10 requests/60s para APIs, 5 intentos/5min para login
- **Sanitización**: Remover `<>'";&|$(){}`, límite 1000 chars
- **Headers**: X-Content-Type-Options, X-Frame-Options, HSTS
- **JWT**: Cookie httpOnly, expiración 24h
- **Validación cédula**: 6-12 dígitos (Colombia)

## Verificación

Después de cada cambio:
```bash
npx tsc --noEmit     # Type-check
npm run lint         # ESLint
npm run build        # Build exitoso
npm run security:check  # Verificar seguridad
```
