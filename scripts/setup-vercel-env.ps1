# Script PowerShell para configurar variables de entorno en Vercel
# Ejecutar este script desde la raíz del proyecto

Write-Host "🔧 Configuración de Variables de Entorno para Vercel" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Verificar si Vercel CLI está instalado
try {
    $null = Get-Command vercel -ErrorAction Stop
    Write-Host "✅ Vercel CLI encontrado" -ForegroundColor Green
}
catch {
    Write-Host "❌ Vercel CLI no está instalado" -ForegroundColor Red
    Write-Host "📦 Instala Vercel CLI con: npm i -g vercel" -ForegroundColor Yellow
    exit 1
}

# Lista de variables de entorno requeridas
$envVars = @(
    "AIRTABLE_API_KEY",
    "AIRTABLE_BASE_ID", 
    "AIRTABLE_COMPRAS_TABLE_ID",
    "AIRTABLE_ITEMS_TABLE_ID",
    "DEBUG_KEY"
)

Write-Host ""
Write-Host "🔍 Variables de entorno requeridas:" -ForegroundColor Yellow
foreach ($var in $envVars) {
    Write-Host "   - $var" -ForegroundColor White
}

Write-Host ""
Write-Host "📋 Para configurar las variables de entorno en Vercel:" -ForegroundColor Yellow
Write-Host "1. Ve a tu dashboard de Vercel: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Selecciona tu proyecto: sirius-financiero" -ForegroundColor White
Write-Host "3. Ve a Settings > Environment Variables" -ForegroundColor White
Write-Host "4. Agrega cada una de las siguientes variables:" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Comandos alternativos usando Vercel CLI:" -ForegroundColor Yellow
Write-Host "vercel env add AIRTABLE_API_KEY" -ForegroundColor Cyan
Write-Host "vercel env add AIRTABLE_BASE_ID" -ForegroundColor Cyan
Write-Host "vercel env add AIRTABLE_COMPRAS_TABLE_ID" -ForegroundColor Cyan
Write-Host "vercel env add AIRTABLE_ITEMS_TABLE_ID" -ForegroundColor Cyan
Write-Host "vercel env add DEBUG_KEY" -ForegroundColor Cyan

Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Red
Write-Host "- Asegúrate de que todas las variables estén configuradas para 'Production'" -ForegroundColor White
Write-Host "- Verifica que los valores sean exactamente los mismos que usas en desarrollo" -ForegroundColor White
Write-Host "- Después de agregar las variables, redeploy tu aplicación" -ForegroundColor White

Write-Host ""
Write-Host "🔄 Para redeployear después de configurar:" -ForegroundColor Yellow
Write-Host "vercel --prod" -ForegroundColor Cyan

Write-Host ""
Write-Host "🧪 Para verificar la configuración:" -ForegroundColor Yellow
Write-Host "Visita: https://sirius-financiero.vercel.app/api/debug/env-check?key=YOUR_DEBUG_KEY" -ForegroundColor Cyan

Write-Host ""
Write-Host "� O usa el panel de diagnóstico:" -ForegroundColor Yellow
Write-Host "https://sirius-financiero.vercel.app/diagnostic" -ForegroundColor Cyan
