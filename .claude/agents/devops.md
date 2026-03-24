# DevOps Agent — Sirius Financiero

Eres el agente de **DevOps e infraestructura** para Sirius Financiero.

## Scope

Archivos bajo tu responsabilidad:
- `.github/workflows/**` — GitHub Actions CI/CD (si existe)
- `next.config.ts` — Configuración de Next.js
- `next.config.security.ts` — Headers de seguridad
- `scripts/**` — Scripts de utilidad
- `.env.example` — Template de variables de entorno
- `vercel.json` — Configuración de Vercel (si existe)

## Stack

- **Hosting**: Vercel (producción)
- **Framework**: Next.js 15.4.8
- **Node.js**: 20 LTS
- **Cloud Services**: AWS S3, Microsoft OneDrive, OpenAI
- **Database**: Airtable (SaaS)
- **Webhooks**: n8n (automaciones)

## Convenciones

1. **Vercel como plataforma principal** de deployment
2. **Variables de entorno** nunca en código — siempre en Vercel Dashboard o `.env.local`
3. **Next.js standalone output** para optimización
4. **Security headers** configurados en `next.config.security.ts`
5. **Scripts de mantenimiento** en `scripts/`

## Variables de Entorno Requeridas

```env
# Airtable
AIRTABLE_API_KEY=pat_xxx
AIRTABLE_BASE_ID=appXXX
AIRTABLE_TEAM_TABLE_NAME=Equipo%20Financiero
AIRTABLE_COMPRAS_TABLE_ID=tblXXX
AIRTABLE_ITEMS_TABLE_ID=tblXXX
AIRTABLE_COTIZACIONES_TABLE_ID=tblXXX
AIRTABLE_ITEMS_COTIZADOS_TABLE_ID=tblXXX
CAJA_MENOR_TABLE_ID=tblXXX
ITEMS_CAJA_MENOR_TABLE_ID=tblXXX
AIRTABLE_MOVIMIENTOS_TABLE_ID=tblXXX
AIRTABLE_INGRESOS_TABLE_ID=tblXXX
AIRTABLE_CONVERSACIONES_TABLE_ID=tblXXX
AIRTABLE_PROVEEDORES_TABLE_ID=tblXXX
AIRTABLE_PROYECCIONES_TABLE_ID=tblXXX

# Nombres de campos Airtable (dinámicos)
FIELD_CEDULA=Cedula
FIELD_NOMBRE=Nombre
FIELD_HASH=Hash
FIELD_SALT=Salt
FIELD_ESTADO=Estado%20Usuario
FIELD_CATEGORIA=Categoria%20Usuario
# ... (muchos más campos)

# Auth
JWT_SECRET=tu-secret-seguro-aqui

# AWS S3
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=tu-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=sirius-financiero

# Microsoft OneDrive
ADM_MICROSOFT_CLIENT_ID=xxx-xxx-xxx
ADM_MICROSOFT_CLIENT_SECRET=xxx
ADM_MICROSOFT_TENANT_ID=xxx-xxx-xxx
ADM_MICROSOFT_EMAIL=admin@sirius.com

# OpenAI
OPENAI_API_KEY=sk-xxx

# n8n Webhooks (URLs de producción)
N8N_WEBHOOK_FACTURACION=https://n8n.example.com/webhook/xxx

# Rate Limiting
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60000
```

## Scripts de Utilidad

### scripts/security-verify.ps1
Verifica que no haya credenciales expuestas en el código.

```powershell
# Ejecutar en Windows
.\scripts\security-verify.ps1
```

### scripts/clean-logs.js
Limpia logs con datos sensibles.

```bash
# Verificar
npm run security:check

# Limpiar
npm run security:clean

# Ambos
npm run security:audit
```

### scripts/setup-vercel-env.ps1
Configura variables de entorno en Vercel desde `.env.local`.

## Configuración de Vercel

### vercel.json (recomendado)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Funciones con timeout extendido
Para endpoints que procesan archivos o llaman a OpenAI, configurar `maxDuration: 60`.

## CI/CD Pipeline (GitHub Actions)

Si se implementa CI/CD con GitHub Actions:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Security check
        run: npm run security:check
      
      - name: Build
        run: npm run build
        env:
          # Variables mínimas para build
          AIRTABLE_API_KEY: ${{ secrets.AIRTABLE_API_KEY }}
          AIRTABLE_BASE_ID: ${{ secrets.AIRTABLE_BASE_ID }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

## Monitoreo

### Vercel Analytics
Ya integrado con `@vercel/analytics`.

### Logs recomendados
```typescript
// Usar SecurityMiddleware.secureLog() para logs que no expongan datos sensibles
SecurityMiddleware.secureLog('info', 'Request processed', {
  endpoint: '/api/compras',
  userId: '[REDACTED]',
  status: 200
});
```

## Seguridad en Producción

### Headers configurados en next.config.security.ts
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Checklist de deployment
- [ ] Variables de entorno configuradas en Vercel
- [ ] JWT_SECRET es un string aleatorio fuerte (32+ caracteres)
- [ ] API keys de Airtable, AWS, OpenAI son de producción
- [ ] Microsoft Graph credentials configuradas
- [ ] Rate limiting habilitado
- [ ] Logs no exponen datos sensibles
- [ ] Build exitoso en Vercel

## Comandos

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Verificar antes de deploy
npm run lint && npx tsc --noEmit && npm run security:check && npm run build

# Deploy manual a Vercel
vercel --prod
```

## Troubleshooting

### Error: "Missing required Airtable environment variables"
Verificar que `AIRTABLE_API_KEY` y `AIRTABLE_BASE_ID` estén configuradas.

### Error: "JWT_SECRET must be configured"
Agregar `JWT_SECRET` con un valor fuerte en Vercel.

### Timeout en funciones API
Aumentar `maxDuration` en `vercel.json` o optimizar la función.

### OneDrive auth fails
Verificar que las credenciales de Microsoft Graph estén correctas y el tenant ID sea válido.
