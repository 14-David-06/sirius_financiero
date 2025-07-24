# 🚨 Guía de Resolución de Problemas - API Error 500 en Producción

## Problema Identificado
El error `GET https://sirius-financiero.vercel.app/api/compras 500 (Internal Server Error)` indica que la API funciona en desarrollo local pero falla en producción.

## Causa Más Probable
**Variables de entorno faltantes o mal configuradas en Vercel.**

## ✅ Solución Paso a Paso

### 1. Verificar el Problema
Visita el panel de diagnóstico que creé para ti:
```
https://sirius-financiero.vercel.app/diagnostic
```

### 2. Configurar Variables de Entorno en Vercel

#### Opción A: Usar el Dashboard de Vercel (Recomendado)
1. Ve a [Dashboard de Vercel](https://vercel.com/dashboard)
2. Selecciona tu proyecto **sirius-financiero**
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables para **Production**:

```
AIRTABLE_API_KEY=tu_api_key_de_airtable
AIRTABLE_BASE_ID=tu_base_id_de_airtable
AIRTABLE_COMPRAS_TABLE_ID=tu_tabla_compras_id
AIRTABLE_ITEMS_TABLE_ID=tu_tabla_items_id
DEBUG_KEY=cualquier_clave_secreta_para_debug
```

#### Opción B: Usar Vercel CLI
```bash
vercel env add AIRTABLE_API_KEY
vercel env add AIRTABLE_BASE_ID
vercel env add AIRTABLE_COMPRAS_TABLE_ID
vercel env add AIRTABLE_ITEMS_TABLE_ID
vercel env add DEBUG_KEY
```

### 3. Redeployar la Aplicación
Después de configurar las variables:
```bash
vercel --prod
```

### 4. Verificar la Solución
1. Espera a que termine el deployment
2. Visita nuevamente: https://sirius-financiero.vercel.app/diagnostic
3. Ejecuta las pruebas del panel de diagnóstico
4. Verifica que tu aplicación funcione correctamente

## 🔍 Herramientas de Diagnóstico Creadas

### API de Diagnóstico
- **Endpoint**: `/api/debug/env-check`
- **Propósito**: Verificar el estado de las variables de entorno
- **URL**: https://sirius-financiero.vercel.app/api/debug/env-check?key=TU_DEBUG_KEY

### Panel de Diagnóstico Web
- **URL**: https://sirius-financiero.vercel.app/diagnostic
- **Funciones**:
  - Probar la API de compras
  - Verificar variables de entorno
  - Mostrar errores detallados

## 🛠️ Mejoras Implementadas en el Código

### 1. Mejor Manejo de Errores
- Logs detallados con `secureLog`
- Mensajes de error más informativos
- Información de debug en desarrollo

### 2. Validación de Configuración
- Verificación explícita de variables de entorno
- Mensajes específicos para cada tipo de error
- Headers de seguridad mejorados

### 3. Herramientas de Diagnóstico
- Endpoint de verificación de salud
- Panel web para diagnóstico visual
- Scripts de ayuda para configuración

## 📋 Checklist de Verificación

- [ ] Variables de entorno configuradas en Vercel
- [ ] Variables configuradas para "Production"
- [ ] Aplicación redeployada
- [ ] Panel de diagnóstico funciona
- [ ] API de compras responde correctamente
- [ ] Aplicación funciona end-to-end

## 🆘 Si el Problema Persiste

1. **Verifica los logs de Vercel**:
   - Ve a tu proyecto en Vercel
   - Selecciona una deployment
   - Revisa la pestaña "Functions"

2. **Usa el panel de diagnóstico**:
   - Ejecuta todas las pruebas
   - Revisa los detalles de los errores

3. **Verifica las credenciales de Airtable**:
   - Asegúrate de que tu API key sea válida
   - Verifica que los IDs de tablas sean correctos
   - Confirma los permisos en Airtable

## 📞 Contacto
Si necesitas ayuda adicional, proporciona:
- Screenshots del panel de diagnóstico
- Logs específicos de error
- Configuración actual de variables de entorno (sin valores sensibles)
