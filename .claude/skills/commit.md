---
skill: commit
trigger: manual
description: Crea commits sin coautoría de Claude y levanta tickets automáticamente en Sirius Tickets
tags: [git, automation, tickets]
---

# Skill: Commit y Crear Ticket

Automatiza el proceso de crear commits y levantar tickets en Sirius Tickets con los cambios realizados.

## Uso

```bash
/commit "mensaje del commit"
```

O simplemente:
```bash
/commit
```

## Comportamiento

1. **Verificar cambios pendientes**: Revisa `git status` para ver qué archivos fueron modificados
2. **Generar mensaje si no se proporciona**: Si no se da mensaje, genera uno basado en los cambios
3. **Crear commit**: Hace commit siguiendo Conventional Commits sin incluir coautoría de Claude
4. **Extraer información del commit**: Obtiene hash, mensaje, archivos modificados y diff
5. **Crear ticket en Sirius Tickets**: Levanta un ticket con los detalles del commit

## Formato de Commit

Sigue Conventional Commits:
- `feat(scope): descripción` - Nueva funcionalidad
- `fix(scope): descripción` - Corrección de bugs
- `refactor(scope): descripción` - Refactorización
- `docs(scope): descripción` - Documentación
- `chore(scope): descripción` - Tareas de mantenimiento
- `test(scope): descripción` - Tests
- `perf(scope): descripción` - Mejoras de rendimiento
- `ci(scope): descripción` - CI/CD
- `style(scope): descripción` - Formato de código
- `build(scope): descripción` - Sistema de build

**NO incluye coautoría de Claude** - Los commits son 100% del usuario.

## Integración con Sirius Tickets

> **NOTA**: Implementación pendiente - requiere endpoint o MCP de Sirius Tickets

### Información necesaria:
- URL de la API de Sirius Tickets
- Método de autenticación (API key, token, etc.)
- Formato del payload para crear tickets
- Campos requeridos

### Datos que se enviarán al ticket:
```json
{
  "titulo": "Commit: <tipo>(<scope>): <mensaje>",
  "descripcion": "<mensaje completo del commit>",
  "categoria": "Desarrollo",
  "cambios": [
    {
      "archivo": "ruta/del/archivo.ts",
      "tipo": "modificado|agregado|eliminado",
      "lineas": "+10, -5"
    }
  ],
  "commit_hash": "abc123...",
  "commit_url": "https://github.com/usuario/repo/commit/abc123",
  "fecha": "2026-11-19T15:30:00-05:00"
}
```

## Ejemplo de Ejecución

```
Usuario: /commit "feat(api): agrega endpoint para facturación"

Claude:
✅ Commit creado: feat(api): agrega endpoint para facturación
   Hash: a1b2c3d
   Archivos modificados: 3
   
📋 Creando ticket en Sirius Tickets...
✅ Ticket #1234 creado exitosamente
   URL: https://sirius.tickets/ticket/1234
```

## Notas de Implementación

- El commit se crea ANTES de intentar crear el ticket
- Si falla la creación del ticket, el commit ya quedó registrado
- Los mensajes de commit deben ser claros y descriptivos
- El scope es opcional pero recomendado
- El diff se limita a 1000 líneas para no sobrecargar el ticket

## Hook de Git (Opcional)

Para automatizar esto a nivel de repositorio:

```bash
# .git/hooks/post-commit
#!/bin/bash
# Crear ticket automáticamente después de cada commit local
# (requiere configuración de API de Sirius Tickets)
```
