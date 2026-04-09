# Sistema de Permisos y Roles - Sirius Financiero

## 📊 Arquitectura de Permisos

### Jerarquía de Categorías

El sistema maneja **4 niveles de acceso** basados en categorías:

| Categoría | Nivel | Descripción | Acceso |
|-----------|-------|-------------|---------|
| **Desarrollador** | 🔴 Super Admin | Acceso total al sistema | ✅ Todo |
| **Gerencia** | 🟠 Alto | Acceso gerencial | ✅ Todos los módulos menos desarrollo |
| **Administrador** | 🟡 Medio | Acceso administrativo | ✅ Módulos administrativos y operativos |
| **Colaborador** | 🟢 Básico | Acceso limitado | ✅ Solo solicitudes de compra |

---

## 🗂️ Estructura en Airtable

### Base: Sirius Nomina Core

**Tabla "Personal":**
```
┌────────────────┬─────────────────────────────────┐
│ Campo          │ Tipo                            │
├────────────────┼─────────────────────────────────┤
│ Nombre         │ Nombre completo del empleado   │
│ Cédula         │ Numero Documento (unique)       │
│ Rol            │ Link → Tabla "Roles y Permisos"│
│ Áreas          │ Link → Tabla "Áreas"           │
│ Password       │ Hash bcrypt                     │
│ Estado         │ Activo / Inactivo              │
└────────────────┴─────────────────────────────────┘
```

**Tabla "Roles y Permisos":**
```
┌────────────────┬─────────────────────────────────┐
│ Campo          │ Tipo                            │
├────────────────┼─────────────────────────────────┤
│ Rol            │ Nombre del rol (ej: INGENIERO)  │
│ Descripción    │ Descripción del rol             │
│ Personal       │ Link ← Tabla "Personal"        │
└────────────────┴─────────────────────────────────┘
```

---

## 🔄 Mapeo de Roles a Categorías

El sistema mapea automáticamente los **nombres de roles** a **categorías de permisos**:

### 🔴 Super Admin (Desarrollador)

Roles que otorgan acceso total:

```typescript
'INGENIERO DE DESARROLLO'
'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)'
'CTO (CHIEF TECHNOLOGY OFFICER)'
'COORDINADORA LIDER GERENCIA'
```

**Acceso:**
- ✅ Todos los módulos
- ✅ Configuración de sistema
- ✅ Gestión de usuarios
- ✅ Módulo de desarrollo/diagnóstico
- ✅ Warehouse completo
- ✅ Facturación
- ✅ Proyecciones
- ✅ Caja menor
- ✅ Compras

### 🟠 Gerencia

Roles de nivel gerencial:

```typescript
'DIRECTOR FINANCIERO'
'JEFE DE PLANTA'
'JEFE DE PRODUCCION'
'SUPERVISOR DE PRODUCCION'
```

**Acceso:**
- ✅ Monitoreo de solicitudes
- ✅ Aprobación de compras
- ✅ Reportes gerenciales
- ✅ Indicadores de producción
- ✅ Simulador de proyecciones
- ✅ Flujo de caja
- ✅ Warehouse (supervisión)
- ❌ Configuración de sistema
- ❌ Gestión de usuarios

### 🟡 Administrador

Roles administrativos:

```typescript
'CONTADORA'
'ASISTENTE FINANCIERO Y CONTABLE'
'COORDINADOR DE COMPRAS'
'ASISTENTE ADMINISTRATIVO'
```

**Acceso:**
- ✅ Caja menor
- ✅ Facturación (ingresos y egresos)
- ✅ Movimientos bancarios
- ✅ Gestión de proveedores
- ✅ Órdenes de compra
- ✅ Warehouse (operación)
- ❌ Monitoreo gerencial
- ❌ Proyecciones financieras
- ❌ Configuración

### 🟢 Colaborador

Cualquier otro rol no especificado:

```typescript
// Todos los demás roles caen en esta categoría
'OPERARIO'
'ASISTENTE'
'AUXILIAR'
// etc.
```

**Acceso:**
- ✅ Solicitudes de compra (crear y ver propias)
- ❌ Todos los demás módulos

---

## 🔧 Implementación Técnica

### Código de Mapeo

**Ubicación:** 
- `src/app/api/validate-user/route.ts`
- `src/app/api/authenticate/route.ts`

```typescript
// Mapeo de roles específicos a categorías de permisos
const rolesToCategoria: Record<string, string> = {
  // Super Admin (acceso total)
  'INGENIERO DE DESARROLLO': 'Desarrollador',
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)': 'Desarrollador',
  'CTO (CHIEF TECHNOLOGY OFFICER)': 'Desarrollador',
  'COORDINADORA LIDER GERENCIA': 'Desarrollador',

  // Gerencia (acceso gerencial)
  'DIRECTOR FINANCIERO': 'Gerencia',
  'JEFE DE PLANTA': 'Gerencia',
  'JEFE DE PRODUCCION': 'Gerencia',
  'SUPERVISOR DE PRODUCCION': 'Gerencia',

  // Administrador (acceso administrativo)
  'CONTADORA': 'Administrador',
  'ASISTENTE FINANCIERO Y CONTABLE': 'Administrador',
  'COORDINADOR DE COMPRAS': 'Administrador',
  'ASISTENTE ADMINISTRATIVO': 'Administrador',

  // Colaborador (acceso básico) - cualquier otro rol
};

categoria = rolesToCategoria[rolNombre] || 'Colaborador';
```

### Middleware de Rutas

**Ubicación:** `middleware.ts`

```typescript
// Rutas administrativas (requieren Administrador, Gerencia o Desarrollador)
const adminRoutes = ['/monitoreo-solicitudes'];

// Rutas elevadas (no accesibles para Colaboradores)
const elevatedRoutes = [
  '/monitoreo-solicitudes',
  '/caja-menor',
  '/inventario-central',
  '/movimientos-bancarios',
  // ...
];

// Rutas warehouse (requieren roles específicos)
const warehouseRoutes = ['/recepcion-almacen', '/warehouse'];
const WAREHOUSE_ALLOWED_ROLES = [
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)',
  'CTO (CHIEF TECHNOLOGY OFFICER)',
  'INGENIERO DE DESARROLLO',
  // ...
];
```

---

## 📋 Matriz de Permisos por Módulo

| Módulo | Colaborador | Administrador | Gerencia | Desarrollador |
|--------|-------------|---------------|----------|---------------|
| **Solicitudes de Compra** | ✅ (propias) | ✅ | ✅ | ✅ |
| **Monitoreo Solicitudes** | ❌ | ❌ | ✅ | ✅ |
| **Mis Solicitudes** | ❌ | ✅ | ✅ | ✅ |
| **Caja Menor** | ❌ | ✅ | ✅ | ✅ |
| **Facturación Ingresos** | ❌ | ✅ | ✅ | ✅ |
| **Facturación Egresos** | ❌ | ✅ | ✅ | ✅ |
| **Movimientos Bancarios** | ❌ | ✅ | ✅ | ✅ |
| **Indicadores Producción** | ❌ | ❌ | ✅ | ✅ |
| **Simulador Proyecciones** | ❌ | ❌ | ✅ | ✅ |
| **Resumen Gerencial** | ❌ | ❌ | ✅ | ✅ |
| **Monitoreo Facturas** | ❌ | ✅ | ✅ | ✅ |
| **Flujo de Caja** | ❌ | ❌ | ✅ | ✅ |
| **Warehouse/Almacén** | ❌ | ✅ | ✅ | ✅ |
| **Diagnósticos** | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 Cómo Asignar Permisos

### Método 1: Cambiar Rol en Airtable

1. Abre **Sirius Nomina Core** en Airtable
2. Ve a la tabla **"Personal"**
3. Busca el usuario por cédula o nombre
4. En la columna **"Rol"**, selecciona el rol deseado de la lista
5. El sistema automáticamente mapeará el rol a la categoría correspondiente

### Método 2: Crear Nuevo Rol

1. Ve a la tabla **"Roles y Permisos"**
2. Crea un nuevo registro:
   ```
   Rol: NOMBRE_DEL_ROL
   Descripción: Descripción del rol
   ```
3. **Importante:** Si quieres que tenga permisos especiales, agrega el nombre del rol exacto al mapeo en el código

### Método 3: Agregar Rol al Mapeo

Para agregar un nuevo rol al sistema de permisos:

1. Edita `src/app/api/validate-user/route.ts`
2. Agrega el rol al objeto `rolesToCategoria`:
   ```typescript
   'NUEVO_ROL_AQUI': 'Desarrollador', // o Gerencia, Administrador, Colaborador
   ```
3. Repite en `src/app/api/authenticate/route.ts`
4. Reinicia el servidor

---

## 🔐 Token JWT

El sistema genera un token JWT con la siguiente estructura:

```typescript
{
  cedula: "1006774686",
  nombre: "Hermes David Hernandez Garcia",
  categoria: "Desarrollador", // ← Esto controla el acceso
  area: "TECNOLOGIA E INNOVACIÓN",
  recordId: "recd9J0zsh5qxVp9i",
  exp: 1733356800 // Expira en 24 horas
}
```

El token se almacena en una cookie `auth-token` y se valida en cada request por el middleware.

---

## 🚨 Consideraciones de Seguridad

1. **Categorías hardcoded:** Las categorías ("Desarrollador", "Gerencia", etc.) están hardcoded en el middleware. No las cambies sin actualizar todo el código.

2. **Caso exacto:** Los nombres de roles deben coincidir **exactamente** (case-sensitive) con los definidos en el mapeo.

3. **Fallback:** Cualquier rol no reconocido se asigna automáticamente como "Colaborador" (acceso mínimo).

4. **JWT expiration:** Los tokens expiran en 24 horas. El usuario debe volver a iniciar sesión.

5. **Warehouse:** Las rutas de warehouse tienen una verificación adicional basada en `WAREHOUSE_ALLOWED_ROLES` en el middleware.

---

## 📝 Ejemplo de Flujo de Autenticación

```
1. Usuario ingresa cédula
   ↓
2. Sistema busca en tabla "Personal"
   ↓
3. Sistema obtiene el "Rol" vinculado
   ↓
4. Sistema consulta tabla "Roles y Permisos"
   ↓
5. Obtiene nombre del rol (ej: "INGENIERO DE DESARROLLO")
   ↓
6. Mapea el rol a categoría (ej: "Desarrollador")
   ↓
7. Genera JWT con la categoría
   ↓
8. Middleware valida la categoría en cada request
   ↓
9. Usuario accede a rutas permitidas ✅
```

---

## 🔄 Agregar Nuevo Usuario con Permisos

### Super Admin (Desarrollador)

```typescript
// En Airtable - Tabla "Personal"
Nombre: Juan Pérez
Cédula: 123456789
Rol: INGENIERO DE DESARROLLO  // ← Esto le da permisos de Desarrollador
Área: TECNOLOGIA E INNOVACIÓN
Estado: Activo
Password: (se configura en primer login)
```

### Usuario Administrativo

```typescript
// En Airtable - Tabla "Personal"
Nombre: María López
Cédula: 987654321
Rol: CONTADORA  // ← Esto le da permisos de Administrador
Área: FINANCIERO
Estado: Activo
Password: (se configura en primer login)
```

---

Fecha: 2026-04-05
Última actualización: Implementación de mapeo automático de roles
Desarrollador: Claude Code (Opus 4.6)
