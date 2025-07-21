#!/bin/bash

# Script de verificación de seguridad para Sirius Financiero
# Ejecutar antes de cada despliegue

echo "🔒 VERIFICACIÓN DE SEGURIDAD - SIRIUS FINANCIERO"
echo "================================================="

# Verificar que .env.local no esté en el repositorio
if [ -f ".env.local" ]; then
    echo "❌ CRÍTICO: .env.local encontrado en el repositorio"
    echo "   Acción: Eliminar del repositorio y cambiar todas las credenciales"
    exit 1
else
    echo "✅ .env.local no está en el repositorio"
fi

# Verificar que .gitignore incluya archivos sensibles
if grep -q "\.env\*" .gitignore; then
    echo "✅ .gitignore configurado correctamente"
else
    echo "❌ .gitignore no protege archivos .env"
    exit 1
fi

# Verificar que no hay credenciales hardcodeadas
if grep -r "patf\|key_\|secret_\|password" src/ --exclude-dir=node_modules; then
    echo "❌ CRÍTICO: Credenciales hardcodeadas encontradas"
    exit 1
else
    echo "✅ No se encontraron credenciales hardcodeadas"
fi

# Verificar que las APIs usen HTTPS
if grep -r "http://" src/ --exclude-dir=node_modules | grep -v "localhost"; then
    echo "⚠️  ADVERTENCIA: URLs HTTP encontradas (usar HTTPS)"
fi

# Verificar que se use el middleware de seguridad
if grep -r "withSecurity" src/app/api/; then
    echo "✅ Middleware de seguridad implementado"
else
    echo "⚠️  ADVERTENCIA: Middleware de seguridad no implementado en todas las rutas"
fi

# Verificar configuración de headers de seguridad
if grep -r "X-Frame-Options\|X-Content-Type-Options" src/; then
    echo "✅ Headers de seguridad configurados"
else
    echo "❌ Headers de seguridad no configurados"
fi

# Verificar que se use validación de entrada
if grep -r "sanitize\|validate" src/; then
    echo "✅ Validación de entrada implementada"
else
    echo "❌ Validación de entrada no implementada"
fi

echo ""
echo "📋 CHECKLIST DE SEGURIDAD:"
echo "[ ] Cambiar API keys después de exposición"
echo "[ ] Configurar HTTPS en producción"
echo "[ ] Implementar rate limiting"
echo "[ ] Configurar monitoreo de seguridad"
echo "[ ] Realizar pruebas de penetración"
echo "[ ] Capacitar al equipo en seguridad"
echo ""
echo "🚨 IMPORTANTE: Revisar el archivo SECURITY_ANALYSIS.md"
echo "📞 Contacto de seguridad: security@siriusregenerative.com"
