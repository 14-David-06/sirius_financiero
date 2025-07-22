#!/bin/bash

# 🔒 SCRIPT DE VERIFICACIÓN DE SEGURIDAD
# Verifica que no haya credenciales expuestas en el código fuente

echo "🔍 Iniciando verificación de seguridad..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para reportar problemas
report_issue() {
    echo -e "${RED}❌ PROBLEMA ENCONTRADO: $1${NC}"
}

# Función para reportar éxito
report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para reportar advertencia
report_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 1. Verificar que archivos .env no estén en git
echo "🔍 Verificando archivos .env en git..."
if git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$" > /dev/null; then
    report_issue "Archivos .env encontrados en git tracking"
    git ls-files | grep -E "\.env"
else
    report_success "No se encontraron archivos .env en git tracking"
fi

# 2. Buscar patrones de API keys en código fuente
echo "🔍 Buscando patrones de API keys..."
if grep -r -E "(pat[A-Za-z0-9\.]{40,}|key[A-Za-z0-9]{20,}|app[A-Za-z0-9]{14})" src/ --exclude-dir=node_modules > /dev/null; then
    report_issue "Posibles API keys encontradas en código fuente:"
    grep -r -E "(pat[A-Za-z0-9\.]{40,}|key[A-Za-z0-9]{20,}|app[A-Za-z0-9]{14})" src/ --exclude-dir=node_modules
else
    report_success "No se encontraron patrones de API keys en código fuente"
fi

# 3. Buscar IDs hardcodeados de Airtable
echo "🔍 Buscando IDs de tabla hardcodeados..."
if grep -r "tbl[A-Za-z0-9]\{14\}" src/ > /dev/null; then
    report_issue "IDs de tabla hardcodeados encontrados:"
    grep -r "tbl[A-Za-z0-9]\{14\}" src/
else
    report_success "No se encontraron IDs de tabla hardcodeados"
fi

# 4. Verificar uso correcto de variables de entorno
echo "🔍 Verificando uso de variables de entorno..."
if grep -r "process\.env\." src/ > /dev/null; then
    report_success "Se encontró uso de variables de entorno"
    # Contar cuántas variables se usan
    var_count=$(grep -r "process\.env\." src/ | wc -l)
    echo "📊 Se encontraron $var_count referencias a process.env"
else
    report_warning "No se encontraron referencias a process.env"
fi

# 5. Buscar URLs potencialmente sensibles
echo "🔍 Buscando URLs potencialmente sensibles..."
if grep -r -E "https?://[a-zA-Z0-9\-\.]+\.elestio\.app" src/ > /dev/null; then
    report_issue "URLs de servicios específicos encontradas en código:"
    grep -r -E "https?://[a-zA-Z0-9\-\.]+\.elestio\.app" src/
else
    report_success "No se encontraron URLs de servicios específicos hardcodeadas"
fi

# 6. Verificar archivos de documentación
echo "🔍 Verificando archivos de documentación..."
if grep -r -E "(pat[A-Za-z0-9\.]{40,}|app[A-Za-z0-9]{14})" *.md > /dev/null 2>&1; then
    report_issue "Posibles credenciales encontradas en documentación:"
    grep -r -E "(pat[A-Za-z0-9\.]{40,}|app[A-Za-z0-9]{14})" *.md
else
    report_success "No se encontraron credenciales en archivos de documentación"
fi

# 7. Verificar estructura de .gitignore
echo "🔍 Verificando .gitignore..."
if grep -q "\.env" .gitignore && grep -q "secrets" .gitignore; then
    report_success ".gitignore configurado correctamente"
else
    report_warning ".gitignore podría necesitar mejoras"
fi

echo ""
echo "🔒 Verificación de seguridad completada"
echo "📝 Revisar cualquier problema reportado arriba"
