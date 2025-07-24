#!/bin/bash

# Script para configurar variables de entorno en Vercel
# Ejecutar este script desde la raíz del proyecto

echo "🔧 Configuración de Variables de Entorno para Vercel"
echo "=================================================="

# Verificar si Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI no está instalado"
    echo "📦 Instala Vercel CLI con: npm i -g vercel"
    exit 1
fi

echo "✅ Vercel CLI encontrado"

# Lista de variables de entorno requeridas
ENV_VARS=(
    "AIRTABLE_API_KEY"
    "AIRTABLE_BASE_ID"
    "AIRTABLE_COMPRAS_TABLE_ID"
    "AIRTABLE_ITEMS_TABLE_ID"
    "DEBUG_KEY"
)

echo ""
echo "🔍 Variables de entorno requeridas:"
for var in "${ENV_VARS[@]}"; do
    echo "   - $var"
done

echo ""
echo "📋 Para configurar las variables de entorno en Vercel:"
echo "1. Ve a tu dashboard de Vercel: https://vercel.com/dashboard"
echo "2. Selecciona tu proyecto: sirius-financiero"
echo "3. Ve a Settings > Environment Variables"
echo "4. Agrega cada una de las siguientes variables:"

echo ""
echo "🔧 Comandos alternativos usando Vercel CLI:"
echo "vercel env add AIRTABLE_API_KEY"
echo "vercel env add AIRTABLE_BASE_ID"
echo "vercel env add AIRTABLE_COMPRAS_TABLE_ID"
echo "vercel env add AIRTABLE_ITEMS_TABLE_ID"
echo "vercel env add DEBUG_KEY"

echo ""
echo "⚠️  IMPORTANTE:"
echo "- Asegúrate de que todas las variables estén configuradas para 'Production'"
echo "- Verifica que los valores sean exactamente los mismos que usas en desarrollo"
echo "- Después de agregar las variables, redeploy tu aplicación"

echo ""
echo "🔄 Para redeployar después de configurar:"
echo "vercel --prod"

echo ""
echo "🧪 Para verificar la configuración:"
echo "Visita: https://sirius-financiero.vercel.app/api/debug/env-check?key=YOUR_DEBUG_KEY"
