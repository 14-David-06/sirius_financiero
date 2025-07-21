# 🚨 PROTOCOLO DE EMERGENCIA DE SEGURIDAD

## ACCIONES INMEDIATAS EN CASO DE BRECHA

### 1. DETECCIÓN DE EXPOSICIÓN DE API KEY (CRÍTICO)

**Si la API key de Airtable fue expuesta:**

```bash
# 1. CAMBIAR INMEDIATAMENTE en Airtable
# - Ir a https://airtable.com/account
# - Personal access tokens → Revocar token actual
# - Crear nuevo token
# - Actualizar .env.local

# 2. Verificar no esté en Git
git log --all -p -S "patfWbjV8m7ZwatsF" --source
git log --all -p -S "70dd64632c8b855d6bb8fe80d370ebe8cda5b1d1161603566de873773c963007" --source

# 3. Si está en Git, usar BFG para limpiar historial
git filter-branch --tree-filter 'find . -name "*.env*" -delete' HEAD
```

### 2. DETECCIÓN DE ACCESO NO AUTORIZADO

**Monitorear logs de Airtable y webhook:**

```bash
# Revisar logs de acceso recientes
grep -r "API_KEY" logs/ || echo "No logs encontrados"

# Verificar patrones de acceso anómalos
grep -r "429\|500\|403" logs/ || echo "No errores encontrados"
```

### 3. LIMPIEZA DE DATOS SENSIBLES

```bash
# Ejecutar limpieza de logs
npm run clean:logs

# Verificar limpieza
npm run verify:logs

# Buscar datos sensibles restantes
grep -r -i "cedula\|password\|token" src/ --exclude-dir=node_modules
```

## 📞 CONTACTOS DE EMERGENCIA

- **Desarrollador Principal**: [CONTACT_INFO]
- **Administrador de Sistemas**: [CONTACT_INFO] 
- **Responsable Legal**: [CONTACT_INFO]
- **Soporte Airtable**: https://support.airtable.com

## 🔧 COMANDOS DE EMERGENCIA

### Deshabilitar APIs temporalmente
```bash
# Crear archivo de mantenimiento
echo "export default function handler() { return new Response('Maintenance', {status: 503}); }" > src/app/api/maintenance.ts
```

### Backup de emergencia
```bash
# Backup de configuración
cp .env.local .env.backup.$(date +%Y%m%d_%H%M%S)

# Backup de base de datos (manual via Airtable)
# 1. Ir a base de datos
# 2. Export → CSV
# 3. Guardar en ubicación segura
```

### Restaurar desde backup
```bash
# Restaurar configuración
cp .env.backup.YYYYMMDD_HHMMSS .env.local

# Reiniciar servicios
npm run dev
```

## 📋 CHECKLIST POST-INCIDENTE

- [ ] API key cambiada en Airtable
- [ ] .env.local actualizado
- [ ] Git history limpio
- [ ] Logs auditados
- [ ] Accesos verificados
- [ ] Documentación actualizada
- [ ] Equipo notificado
- [ ] Medidas preventivas implementadas

## 🛡️ PREVENCIÓN FUTURA

1. **Nunca commitear archivos .env***
2. **Usar variables de entorno en producción**
3. **Rotar API keys mensualmente**
4. **Monitorear accesos regularmente**
5. **Mantener logs de auditoría**
6. **Backup regular de configuraciones**

---
**© 2025 Sirius Regenerative Solutions S.A.S ZOMAC**
**Documento CONFIDENCIAL - Solo para equipo de seguridad**
