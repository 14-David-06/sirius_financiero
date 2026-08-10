# Configuración de Variables de Entorno DIAN para Producción

## Problema Resuelto

El error `Variable de entorno requerida no configurada: AIRTABLE_FIELD_DIAN_CREADA` ocurría porque durante el build de Next.js se pre-renderizan las rutas API, y al hacerlo se ejecutaba la validación de campos DIAN.

## Solución Implementada

Se modificó `src/lib/config/dian-fields.ts` para usar **validación lazy** (con getters), de modo que la validación solo se ejecuta cuando realmente se accede a cada campo, no durante el import.

## Variables de Entorno Requeridas

Para que el módulo de Movimientos DIAN funcione correctamente en producción, debes configurar las siguientes variables:

### 1. Tabla DIAN (ID de la tabla en Airtable)

```bash
AIRTABLE_DIAN_TABLE_ID=tblXXXXXXXXXXXXXX
```

### 2. Nombres de Campos DIAN

Estas variables mapean los nombres exactos de las columnas en tu tabla de Airtable:

```bash
# Fecha de creación del registro
AIRTABLE_FIELD_DIAN_CREADA=Creada

# Identificación del documento
AIRTABLE_FIELD_DIAN_TIPO_DOCUMENTO=Tipo Documento
AIRTABLE_FIELD_DIAN_PREFIJO_FOLIO=Prefijo/Folio
AIRTABLE_FIELD_DIAN_CUFE=CUFE

# Fechas del documento
AIRTABLE_FIELD_DIAN_FECHA_EMISION=Fecha Emisión
AIRTABLE_FIELD_DIAN_FECHA_RECEPCION=Fecha Recepción

# Partes (emisor y receptor)
AIRTABLE_FIELD_DIAN_NIT_EMISOR=NIT Emisor
AIRTABLE_FIELD_DIAN_NOMBRE_EMISOR=Nombre Emisor
AIRTABLE_FIELD_DIAN_NOMBRE_RECEPTOR=Nombre Receptor

# Valores monetarios
AIRTABLE_FIELD_DIAN_IVA=IVA
AIRTABLE_FIELD_DIAN_TOTAL=Total

# Clasificación
AIRTABLE_FIELD_DIAN_ESTADO=Estado
AIRTABLE_FIELD_DIAN_GRUPO=Grupo
```

### 3. Variable del Webhook n8n (opcional)

Si usas el workflow de n8n para consultar movimientos DIAN:

```bash
N8N_WEBHOOK_MOVIMIENTOS_DIAN_URL=https://tu-instancia-n8n.com/webhook/movimientos-dian
```

## Cómo Configurar en tu Plataforma de Deployment

### Vercel
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega cada variable una por una
4. Redeploy tu aplicación

### AWS Amplify
1. Ve a tu app en AWS Amplify
2. Environment variables
3. Agrega todas las variables
4. Redeploy

### Netlify
1. Site settings → Environment variables
2. Agrega las variables
3. Redeploy

### Railway / Render
1. Variables tab en tu servicio
2. Agrega las variables
3. El servicio se redesplegarà automáticamente

## Verificación

Después de configurar las variables, verifica que el endpoint funciona:

```bash
# Verificar configuración
GET https://tu-dominio.com/api/movimientos-dian

# Obtener resumen (últimos 50 documentos)
GET https://tu-dominio.com/api/movimientos-dian/resumen

# Obtener documentos desde una fecha
GET https://tu-dominio.com/api/movimientos-dian/resumen?desde=2026-01-01
```

## ¿Cómo Obtener los Nombres de Campos Exactos?

1. Abre tu base de Airtable
2. Ve a la tabla DIAN
3. Copia exactamente el nombre de cada columna (respetando mayúsculas, tildes y espacios)
4. Asigna ese nombre a la variable correspondiente

**Ejemplo:**
- Si tu columna se llama "Fecha Emisión" → `AIRTABLE_FIELD_DIAN_FECHA_EMISION=Fecha Emisión`
- Si tu columna se llama "FechaEmision" → `AIRTABLE_FIELD_DIAN_FECHA_EMISION=FechaEmision`

## Notas Importantes

- Los valores en `.env.example` son **ejemplos** genéricos
- Debes reemplazarlos con los nombres reales de tus columnas en Airtable
- Si no usas algún endpoint DIAN, las variables seguirán siendo requeridas para que el build pase, pero solo fallarán en runtime si intentas usar ese endpoint específico
- Con la validación lazy implementada, el build NO fallará aunque falten variables, pero los endpoints DIAN devolverán error 500 si se llaman sin la configuración completa

## Archivos Modificados

- ✅ `src/lib/config/dian-fields.ts` - Validación lazy con getters
- ✅ `.env.example` - Documentación de variables DIAN
- ✅ `DIAN_ENV_SETUP.md` - Esta guía

## Estado Actual

Con los cambios implementados:
- ✅ El build en producción NO fallará por variables DIAN faltantes
- ⚠️ Los endpoints `/api/movimientos-dian/resumen` fallarán en runtime si se llaman sin configurar las variables
- ✅ El resto de la aplicación (Caja Menor, Compras, etc.) NO se ve afectada por variables DIAN faltantes
