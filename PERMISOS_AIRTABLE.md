# 🔐 Solución: Error de Permisos en Airtable

## Problema Actual

```
AirtableError {
  error: 'NOT_AUTHORIZED',
  message: 'You are not authorized to perform this operation',
  statusCode: 403
}
```

Tu API Key **no tiene permisos** para acceder a la base **"Sirius Nomina Core"**.

## 🎯 Soluciones (elige una)

### Opción 1: Dar Permisos a la API Key Existente (Recomendado)

Si estás usando una sola API Key para todas las bases:

1. **Ve a Airtable**: https://airtable.com/
2. **Abre la base "Sirius Nomina Core"**
3. **Clic en "Share"** (botón arriba a la derecha)
4. **Ve a la pestaña "API"**
5. **Asegúrate de que tu API Key tenga acceso**:
   - Si no aparece, agrégala
   - Dale permisos de **"Editor"** o **"Read Only"** (mínimo)

### Opción 2: Crear una API Key Específica para Nomina

Si prefieres tener API Keys separadas:

1. **Ve a Airtable**: https://airtable.com/account
2. **En el menú lateral, clic en "Tokens"** (o "Developer Hub")
3. **Crea un nuevo Personal Access Token**:
   - Nombre: "Sirius Nomina API"
   - Scopes necesarios:
     - ✅ `data.records:read` (lectura de registros)
     - ✅ `data.records:write` (escritura - si necesitas crear/editar)
     - ✅ `schema.bases:read` (lectura de estructura)
   - Bases: Selecciona **"Sirius Nomina Core"**
4. **Copia el token generado**
5. **Agrégalo a tu `.env.local`**:
   ```env
   NOMINA_AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
   ```

### Opción 3: Usar la Misma API Key para Todo

Si ya tienes `AIRTABLE_API_KEY` funcionando:

1. Ve a Airtable y verifica que esa API Key tenga acceso a **AMBAS** bases:
   - ✅ Sirius Financiero (base principal)
   - ✅ Sirius Nomina Core
2. **NO necesitas** `NOMINA_AIRTABLE_API_KEY` si usas la misma key
3. La aplicación automáticamente usará `AIRTABLE_API_KEY` para ambas

## 🔍 Verificar Configuración Actual

Revisa tu archivo `.env.local` y verifica:

```env
# Base Principal
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Base Nomina Core
NOMINA_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX  ← ¿Está correcto?
NOMINA_AIRTABLE_API_KEY=patXXXXXXXXXXXXXX  ← ¿Está configurado? (opcional)
```

## ⚠️ Puntos Importantes

1. **Si usas `NOMINA_AIRTABLE_API_KEY`**: Esa key debe tener acceso a la base Nomina
2. **Si NO usas `NOMINA_AIRTABLE_API_KEY`**: La `AIRTABLE_API_KEY` debe tener acceso a AMBAS bases
3. **El `NOMINA_AIRTABLE_BASE_ID` debe ser correcto**: Verifica que sea el ID de la base Nomina Core

## 🧪 Cómo Probar

Después de dar permisos:

1. **Reinicia el servidor**: `Ctrl+C` y luego `npm run dev`
2. **Verifica en los logs**:
   ```
   🔑 Usando API Key: NOMINA_AIRTABLE_API_KEY (específica)
   📦 Base ID: appXXXXX...
   ```
3. **Ve al diagnóstico**: http://localhost:3001/api/diagnostico-empleados
4. **Deberías ver**: `"success": true` con los datos de empleados

## 🆘 Si Sigue Sin Funcionar

Envíame:
1. Los logs completos del servidor (la parte de 🔑 y 📦)
2. Confirma si estás usando una o dos API Keys
3. El output de http://localhost:3001/api/diagnostico-empleados
