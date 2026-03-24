# Sirius Financiero — Sistema de Desarrollo Multi-Agente

Infraestructura de agentes de desarrollo para **Sirius Financiero**, construida sobre Claude Code CLI.

## Estructura

```
.
├── CLAUDE.md                          # Instrucciones globales (leído automáticamente)
├── .claude/
│   ├── settings.json                  # Permisos y configuración
│   ├── agents/                        # 5 agentes de desarrollo
│   │   ├── backend-dev.md             # APIs, Airtable, integraciones, seguridad
│   │   ├── frontend-dev.md            # React 19, Tailwind 4, glass-morphism UI
│   │   ├── qa-tester.md               # Code review, seguridad OWASP
│   │   ├── docs-writer.md             # Documentación técnica en español
│   │   └── devops.md                  # CI/CD, Vercel, deployment
│   └── skills/                        # Conocimiento de dominio
│       ├── airtable-patterns.md       # Patrones de Airtable financiero
│       ├── api-conventions.md         # Convenciones de APIs Next.js
│       └── financial-domain.md        # Dominio financiero colombiano
```

## Agentes Disponibles

| # | Agente | Scope | Propósito |
|---|--------|-------|-----------|
| 1 | **backend-dev** | `src/app/api/**`, `src/lib/**` | APIs, Airtable, OpenAI, OneDrive, S3, seguridad |
| 2 | **frontend-dev** | `src/app/*/page.tsx`, `src/components/**` | React 19, Tailwind 4, Recharts, hooks |
| 3 | **qa-tester** | Todo el proyecto | Code review, OWASP, validación de seguridad |
| 4 | **docs-writer** | `docs/**`, README, CHANGELOG | Documentación técnica en español colombiano |
| 5 | **devops** | Scripts, configs, deployment | Vercel, variables de entorno, CI/CD |

## Skills de Dominio

| Skill | Contenido |
|-------|-----------|
| **airtable-patterns** | Conexión SDK, tablas, campos dinámicos, relaciones, attachments |
| **api-conventions** | JWT auth, RBAC, SSE streaming, webhooks, rate limiting |
| **financial-domain** | Módulos del sistema, flujos de negocio, proveedores, fiscal colombiano |

## Uso con Claude Code CLI

```bash
# Instalar Claude Code CLI (si no está instalado)
irm https://claude.ai/install.ps1 | iex

# Navegar al proyecto
cd c:\Users\siriu\Developer\sirius_financiero

# Usar un agente específico
claude "Usa el backend-dev subagent para crear un endpoint de reportes"

claude "Usa el frontend-dev subagent para crear la página de reportes"

claude "Usa el qa-tester subagent para revisar la seguridad de src/lib/security.ts"

claude "Usa el docs-writer subagent para documentar el módulo de caja menor"
```

## Uso con VS Code / GitHub Copilot

Los agentes están disponibles como instrucciones en `.claude/agents/`. 
Copilot puede leer estos archivos para contexto especializado.

## Verificación

```bash
# Type-check
npx tsc --noEmit

# Linting
npm run lint

# Build de producción
npm run build

# Verificar seguridad
npm run security:check
```

## Stack Tecnológico

- **Frontend**: React 19, Next.js 15.4, Tailwind CSS 4, Recharts
- **Backend**: Next.js API Routes, Airtable SDK, JWT auth
- **IA**: OpenAI GPT-4o-mini (agentes), Whisper-1 (transcripción)
- **Cloud**: AWS S3, Microsoft OneDrive (Graph API)
- **Automatización**: n8n webhooks
- **Deployment**: Vercel
