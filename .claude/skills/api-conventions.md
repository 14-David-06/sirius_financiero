# Skill: Convenciones de API — Sirius Financiero

Conocimiento de dominio sobre las convenciones de API routes en Sirius Financiero.

## Estructura de Endpoints

Next.js App Router: un archivo `route.ts` por recurso con funciones HTTP exportadas.

```
src/app/api/
├── authenticate/route.ts       # POST — Login
├── check-session/route.ts      # GET — Validar sesión
├── logout/route.ts             # POST — Cerrar sesión
├── setup-password/route.ts     # POST — Configurar password inicial
├── validate-user/route.ts      # POST — Validar usuario existe
│
├── compras/route.ts            # GET — Listar compras
├── solicitudes-compra/route.ts # POST — Nueva solicitud
├── cotizaciones/
│   ├── save/route.ts          # POST — Guardar cotización
│   └── extract/route.ts       # POST — Extraer de PDF
├── proveedores/route.ts        # GET — Listar proveedores
├── catalogo-insumos/route.ts   # GET — Catálogo insumos
├── items/route.ts              # GET/POST — CRUD items
│
├── caja-menor/route.ts         # GET/POST/PATCH
├── caja-menor-agent/route.ts   # POST — Chat IA
├── caja-menor-analisis/route.ts # GET — Análisis
├── consolidar-caja-menor/route.ts # POST
│
├── facturacion-ingresos/route.ts
├── facturacion-egresos-callback/route.ts  # POST — Webhook n8n
├── facturacion-stream/[transactionId]/route.ts  # GET — SSE
│
├── movimientos-bancarios/route.ts
├── movimientos-bancarios-bancolombia/route.ts
├── movimientos-bancarios-bbva/route.ts
│
├── chat-compras/route.ts       # GET/POST — Chat solicitudes
├── transcribe-audio/route.ts   # POST — Whisper
│
├── upload-onedrive/route.ts    # POST — Microsoft Graph
├── upload-file/route.ts        # POST — AWS S3
└── ...
```

## Patrón de Autenticación JWT

### Cookie-based auth
```typescript
// Obtener token de cookie
const token = request.cookies.get('auth-token')?.value;
```

### Verificación completa
```typescript
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  // 1. Extraer token
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 2. Verificar firma y decodificar
    const decoded = jwt.verify(token, JWT_SECRET) as {
      cedula: string;
      nombre: string;
      categoria: string;
      exp?: number;
    };

    // 3. Verificar expiración
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Token expirado" }, { status: 401 });
    }

    // 4. Lógica del endpoint...
    return NextResponse.json({ data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
```

## RBAC — Categorías y Niveles

```
Desarrollador (4) → Acceso total, debugging
Gerencia      (3) → Reportes ejecutivos, aprobaciones
Administrador (2) → Gestión operativa, monitoreo
Colaborador   (1) → Solo solicitudes propias
```

### Verificación de categoría
```typescript
const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador'];
if (!allowedCategories.includes(decoded.categoria)) {
  return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
}
```

### Colaborador: solo sus datos
```typescript
// Para Colaborador, filtrar por su cédula
if (decoded.categoria === 'Colaborador') {
  filterFormula = `{Solicitante Cedula} = "${decoded.cedula}"`;
}
```

## Respuestas HTTP Estándar

### Éxito (200)
```typescript
return NextResponse.json({ 
  success: true,
  data: records 
});
```

### Creación (201)
```typescript
return NextResponse.json({ 
  success: true,
  data: newRecord 
}, { status: 201 });
```

### Error de autenticación (401)
```typescript
return NextResponse.json({ 
  error: "No autorizado" 
}, { status: 401 });
```

### Error de permisos (403)
```typescript
return NextResponse.json({ 
  error: "Sin permisos para esta acción" 
}, { status: 403 });
```

### Error de validación (400)
```typescript
return NextResponse.json({ 
  error: "Cédula es requerida",
  code: "VALIDATION_ERROR"
}, { status: 400 });
```

### Rate limit (429)
```typescript
import { SecurityMiddleware } from "@/lib/security";

if (!SecurityMiddleware.checkRateLimit(request)) {
  return SecurityMiddleware.createRateLimitResponse();
}
// Respuesta incluye header Retry-After: 60
```

### Error interno (500)
```typescript
return NextResponse.json({ 
  error: "Error interno del servidor" 
}, { status: 500 });
// NUNCA exponer detalles del error: stack trace, query, etc.
```

## SSE Streaming Pattern

Para procesos largos: facturación, agentes IA, transcripción.

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const { transactionId } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Enviar evento de inicio
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ 
          status: "processing", 
          transactionId 
        })}\n\n`)
      );

      // Simular proceso largo
      await someAsyncProcess();

      // Enviar resultado
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ 
          status: "completed", 
          result: data 
        })}\n\n`)
      );

      // Cerrar stream
      controller.close();
    },
    cancel() {
      // Cleanup si el cliente cierra conexión
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Para nginx
    },
  });
}
```

### Cliente SSE (frontend)
```typescript
const eventSource = new EventSource(`/api/facturacion-stream/${transactionId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.status === 'completed') {
    setResult(data.result);
    eventSource.close();
  }
};

eventSource.onerror = () => {
  eventSource.close();
};
```

## Webhook Pattern (n8n)

```typescript
// POST /api/facturacion-egresos-callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar payload esperado
    const { transactionId, resultado, factura } = body;
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId requerido" }, { status: 400 });
    }

    // Procesar callback
    await updateAirtableRecord(factura);

    // Notificar al stream SSE (si existe)
    await notifySSEClient(transactionId, resultado);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
}
```

## Upload de Archivos

### Multipart form data
```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  // Validar tipo
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  // Validar tamaño (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Archivo muy grande (máx 10MB)" }, { status: 400 });
  }

  // Convertir a buffer para S3
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Subir a S3...
}
```

## Rate Limiting

```typescript
import { SecurityMiddleware } from "@/lib/security";

export async function POST(request: NextRequest) {
  // Verificar rate limit (10 req/60s por defecto)
  if (!SecurityMiddleware.checkRateLimit(request)) {
    return SecurityMiddleware.createRateLimitResponse();
  }

  // Continuar con la lógica...
}
```

## Sanitización de Inputs

```typescript
import { SecurityMiddleware } from "@/lib/security";

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Sanitizar cada campo
  const cedula = SecurityMiddleware.sanitizeInput(body.cedula || '');
  const nombre = SecurityMiddleware.sanitizeInput(body.nombre || '');

  // Validar formato específico
  if (!SecurityMiddleware.validateCedula(cedula)) {
    return SecurityMiddleware.createValidationErrorResponse("Cédula inválida");
  }

  // Continuar con datos seguros...
}
```
