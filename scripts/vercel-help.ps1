Write-Host "🔧 Configuración de Variables de Entorno para Vercel" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Variables de entorno requeridas:" -ForegroundColor Yellow
Write-Host "- AIRTABLE_API_KEY" -ForegroundColor White
Write-Host "- AIRTABLE_BASE_ID" -ForegroundColor White  
Write-Host "- AIRTABLE_COMPRAS_TABLE_ID" -ForegroundColor White
Write-Host "- AIRTABLE_ITEMS_TABLE_ID" -ForegroundColor White
Write-Host "- DEBUG_KEY" -ForegroundColor White

Write-Host ""
Write-Host "Pasos para configurar en Vercel:" -ForegroundColor Yellow
Write-Host "1. Ve a: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Selecciona tu proyecto: sirius-financiero" -ForegroundColor White
Write-Host "3. Ve a Settings > Environment Variables" -ForegroundColor White
Write-Host "4. Agrega cada variable para 'Production'" -ForegroundColor White
Write-Host "5. Redeploy con: vercel --prod" -ForegroundColor White

Write-Host ""
Write-Host "Para verificar:" -ForegroundColor Yellow
Write-Host "https://sirius-financiero.vercel.app/diagnostic" -ForegroundColor Cyan
