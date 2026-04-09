# Solución al Error 403 en Autenticación de Airtable

## 🚨 Problema Identificado

El sistema usa **3 bases diferentes de Airtable**, pero estaba intentando usar la misma API key para todas:

| Base | Variable Base ID | API Key Usada | Estado |
|------|-----------------|---------------|---------|
| **Base Financiera** | `AIRTABLE_BASE_ID` | `AIRTABLE_API_KEY` | ✅ OK |
| **Nomina Core** | `NOMINA_AIRTABLE_BASE_ID` | `AIRTABLE_API_KEY` | ❌ Error 403 |
| **Insumos Core** | `AIRTABLE_INS_BASE_ID` | `AIRTABLE_INS_API_KEY` | ✅ OK |

### Error Observado
```
🚨 Error al consultar Nomina Core { status: 403 }
POST /api/validate-user 500
```

**Causa raíz:** El token `AIRTABLE_API_KEY` fue creado solo con permisos para la Base Financiera, pero el código de autenticación (`validate-user`, `authenticate`, `setup-password`) lo usaba para acceder a la Base Nomina Core.

---

## ✅ Solución Implementada

### Cambios en el Código

**Archivos modificados:**
1. `src/app/api/validate-user/route.ts`
2. `src/app/api/authenticate/route.ts`
3. `src/app/api/setup-password/route.ts`
4. `.env.example`

**Antes:**
```typescript
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
```

**Después:**
```typescript
// Usar token específico de Nomina si existe, sino usar el token general
const AIRTABLE_API_KEY = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
```

### Opciones de Configuración

#### **Opción 1: Token único con permisos múltiples** (Más simple)

Usa el mismo token para ambas bases, pero configúralo con permisos para ambas:

**En `.env.local`:**
```env
# Un solo token con permisos para Base Financiera Y Base Nomina Core
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX.XXXX...
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
NOMINA_AIRTABLE_BASE_ID=appYYYYYYYYYYYYYY
# No configurar NOMINA_AIRTABLE_API_KEY - usará AIRTABLE_API_KEY
```

**Configuración del token en Airtable:**
1. Ve a https://airtable.com/create/tokens
2. Edita tu token existente
3. En "Bases", agrega tanto:
   - Base Financiera (la que ya tenías)
   - Sirius Nomina Core (nueva)
4. Permisos requeridos:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`

#### **Opción 2: Tokens separados** (Más seguro)

Usa tokens diferentes para cada base:

**En `.env.local`:**
```env
# Token para Base Financiera
AIRTABLE_API_KEY=patAAAAAAAAAAAAA.XXXX...
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Token separado para Base Nomina Core (autenticación)
NOMINA_AIRTABLE_API_KEY=patBBBBBBBBBBBBB.YYYY...
NOMINA_AIRTABLE_BASE_ID=appYYYYYYYYYYYYYY
```

**Ventaja:** Mayor seguridad - si un token se compromete, no afecta todas las bases.

---

## 🔐 Cómo Crear/Editar Personal Access Tokens

### Crear Token Nuevo

1. **Ve a:** https://airtable.com/create/tokens
2. **Clic en:** "Create new token"
3. **Nombre:** `Sirius Financiero - [Base Name]`
4. **Permisos (Scopes):**
   - ✅ `data.records:read` - Leer registros
   - ✅ `data.records:write` - Crear/actualizar registros
   - ✅ `schema.bases:read` - Leer estructura de bases
5. **Bases (Access):**
   - Selecciona la base específica (ej: "Sirius Nomina Core")
6. **Clic en:** "Create token"
7. **IMPORTANTE:** Copia el token inmediatamente (solo se muestra una vez)

### Editar Token Existente

1. **Ve a:** https://airtable.com/account
2. **Sección:** "Developer Hub" → "Personal access tokens"
3. **Encuentra tu token** (ej: `patf1beKEaPTAEyvI...`)
4. **Clic en:** ⚙️ (icono de configuración)
5. **En "Bases":** Agrega las bases faltantes
6. **Guarda cambios**

---

## 🧪 Verificación

### 1. Verificar Variables de Entorno

```bash
# Desde la raíz del proyecto
grep -E "NOMINA_AIRTABLE|AIRTABLE_API_KEY" .env.local
```

**Debe mostrar al menos:**
```env
AIRTABLE_API_KEY=patXXXXXXXX...
NOMINA_AIRTABLE_BASE_ID=appYYYYYYYY...
```

### 2. Probar Autenticación

```bash
npm run dev
```

1. Abre http://localhost:3000
2. Ingresa una cédula válida
3. **Antes:** Error 403
4. **Después:** Usuario validado ✅

### 3. Verificar en Logs

```
✅ Usuario validado exitosamente (Nomina Core)
```

---

## 📊 Arquitectura Multi-Base

```
┌────────────────────────────────────────────────┐
│           Next.js Application                  │
└────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Base       │ │   Nomina     │ │   Insumos    │
│ Financiera   │ │    Core      │ │    Core      │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ Compras      │ │ Personal     │ │ Inventario   │
│ Facturación  │ │ Roles        │ │ Movimientos  │
│ Caja Menor   │ │ Áreas        │ │ Stock        │
│ Bancos       │ │ (Auth)       │ │ Warehouse    │
└──────────────┘ └──────────────┘ └──────────────┘
       │               │               │
       ▼               ▼               ▼
 AIRTABLE_API_KEY  NOMINA_API_KEY  AIRTABLE_INS_
                    (fallback a     API_KEY
                   AIRTABLE_API_KEY)
```

---

## 🎯 Recomendación Final

**Para este proyecto, recomiendo usar Opción 1** (token único con permisos múltiples):

### Razones:
1. ✅ **Más simple:** Solo un token que administrar
2. ✅ **Sin cambios en `.env.local`:** Solo editar permisos del token actual
3. ✅ **Compatibilidad:** El código ya tiene fallback implementado
4. ✅ **Menos configuración:** No necesitas crear tokens adicionales

### Paso a paso:
1. Ve a https://airtable.com/account
2. Edita tu token actual (`patf1beKEaPTAEyvI...`)
3. Agrega la base "Sirius Nomina Core" en "Access"
4. Guarda cambios
5. Reinicia el servidor (`npm run dev`)
6. ¡Listo! 🎉

---

## 📚 Referencias

- [Airtable Personal Access Tokens](https://airtable.com/developers/web/guides/personal-access-tokens)
- [Token Permissions (Scopes)](https://airtable.com/developers/web/api/scopes)
- [Airtable Multi-Base Setup](https://support.airtable.com/docs/creating-a-personal-access-token)

---

Fecha: 2026-04-05
Desarrollador: Claude Code (Opus 4.6)
