# 🔒 SCRIPT DE VERIFICACIÓN DE SEGURIDAD
# Verifica que no haya credenciales expuestas en el código fuente

Write-Host "🔍 Iniciando verificación de seguridad..." -ForegroundColor Cyan

# Función para reportar problemas
function Report-Issue {
    param($message)
    Write-Host "❌ PROBLEMA ENCONTRADO: $message" -ForegroundColor Red
}

# Función para reportar éxito
function Report-Success {
    param($message)
    Write-Host "✅ $message" -ForegroundColor Green
}

# Función para reportar advertencia
function Report-Warning {
    param($message)
    Write-Host "⚠️ $message" -ForegroundColor Yellow
}

# 1. Verificar que archivos .env no estén en git
Write-Host "🔍 Verificando archivos .env en git..." -ForegroundColor Cyan
$envInGit = git ls-files | Select-String -Pattern "\.env$|\.env\.local$|\.env\.production$"
if ($envInGit) {
    Report-Issue "Archivos .env encontrados en git tracking"
    $envInGit
} else {
    Report-Success "No se encontraron archivos .env en git tracking"
}

# 2. Buscar patrones de API keys en código fuente
Write-Host "🔍 Buscando patrones de API keys..." -ForegroundColor Cyan
$apiKeyPatterns = Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "pat[A-Za-z0-9\.]{40}" 2>$null
if ($apiKeyPatterns) {
    Report-Issue "Posibles API keys encontradas en código fuente:"
    $apiKeyPatterns
} else {
    Report-Success "No se encontraron patrones de API keys en código fuente"
}

# 3. Buscar IDs hardcodeados de Airtable
Write-Host "🔍 Buscando IDs de tabla hardcodeados..." -ForegroundColor Cyan
$hardcodedIds = Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "tbl[A-Za-z0-9]{14}" 2>$null
if ($hardcodedIds) {
    Report-Issue "IDs de tabla hardcodeados encontrados:"
    $hardcodedIds
} else {
    Report-Success "No se encontraron IDs de tabla hardcodeados"
}

# 4. Verificar uso correcto de variables de entorno
Write-Host "🔍 Verificando uso de variables de entorno..." -ForegroundColor Cyan
$envUsage = Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "process\.env\." 2>$null
if ($envUsage) {
    Report-Success "Se encontró uso de variables de entorno"
    $varCount = ($envUsage | Measure-Object).Count
    Write-Host "📊 Se encontraron $varCount referencias a process.env" -ForegroundColor Blue
} else {
    Report-Warning "No se encontraron referencias a process.env"
}

# 5. Buscar URLs potencialmente sensibles
Write-Host "🔍 Buscando URLs potencialmente sensibles..." -ForegroundColor Cyan
$sensitiveUrls = Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "elestio\.app" 2>$null
if ($sensitiveUrls) {
    Report-Issue "URLs de servicios específicos encontradas en código:"
    $sensitiveUrls
} else {
    Report-Success "No se encontraron URLs de servicios específicos hardcodeadas"
}

# 6. Verificar archivos de documentación
Write-Host "🔍 Verificando archivos de documentación..." -ForegroundColor Cyan
$credentialsInDocs = Get-ChildItem -Path "." -Filter "*.md" | Select-String -Pattern "pat[A-Za-z0-9\.]{40}" 2>$null
if ($credentialsInDocs) {
    Report-Issue "Posibles credenciales encontradas en documentación:"
    $credentialsInDocs
} else {
    Report-Success "No se encontraron credenciales en archivos de documentación"
}

# 7. Verificar estructura de .gitignore
Write-Host "🔍 Verificando .gitignore..." -ForegroundColor Cyan
$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue
if ($gitignoreContent -and ($gitignoreContent -match "\.env") -and ($gitignoreContent -match "secrets")) {
    Report-Success ".gitignore configurado correctamente"
} else {
    Report-Warning ".gitignore podría necesitar mejoras"
}

Write-Host ""
Write-Host "🔒 Verificación de seguridad completada" -ForegroundColor Cyan
Write-Host "📝 Revisar cualquier problema reportado arriba" -ForegroundColor Yellow
