# Configuración de Campos de Empleados en Airtable

## Problema Resuelto

Se eliminó todo el código hardcodeado de cargos y áreas de empleados. Ahora el sistema obtiene esta información **exclusivamente desde Airtable**.

## Requisitos en Airtable

Para que la funcionalidad de solicitudes de compra funcione correctamente, la tabla **"Equipo Financiero"** en Airtable debe tener los siguientes campos:

### Campos Requeridos

| Campo en Airtable | Variable de Entorno | Descripción | Tipo de Campo |
|-------------------|---------------------|-------------|---------------|
| `Nombre` | `AIRTABLE_FIELD_NOMBRE` | Nombre completo del empleado | Single line text |
| `Cedula` | `AIRTABLE_FIELD_CEDULA` | Cédula del empleado | Single line text |
| `Cargo` | `AIRTABLE_FIELD_CARGO` | Cargo o posición del empleado | Single line text |
| `Área` | `AIRTABLE_FIELD_AREA` | Área de trabajo del empleado | Single select o Single line text |
| `Estado Usuario` | `AIRTABLE_FIELD_ESTADO_USUARIO` | Estado del usuario (Activo/Inactivo) | Single select |

### Valores Recomendados para el Campo "Área"

Para mantener consistencia con los centros de costo configurados, se recomienda usar uno de estos valores:

- **Laboratorio** - Centros de costo: Hongos, Bacterias, Análisis
- **Pirolisis** - Centros de costo: Mantenimiento, Novedades, Blend
- **Administrativo** - Centros de costo: Administración, Mercadeo, Otros Gastos ADM
- **RAAS** - Centros de costo: Tecnología, Equipos Tecnológicos
- **Gestión del Ser** - Centros de costo: Administración, Mercadeo, Otros Gastos ADM
- **SST** - Centros de costo: Administración, Mercadeo, Otros Gastos ADM

## Pasos para Configurar

### 1. Verificar que los Campos Existen

En tu tabla "Equipo Financiero" en Airtable:

1. Abre la tabla
2. Verifica que existan las columnas: **Nombre**, **Cedula**, **Cargo**, **Área**, **Estado Usuario**
3. Si falta alguna columna, créala con el tipo de campo indicado arriba

### 2. Llenar los Datos

Para cada empleado activo:

1. **Nombre**: Nombre completo (ej: "Hermes David Hernandez Garcia")
2. **Cedula**: Número de cédula
3. **Cargo**: Posición en la empresa (ej: "Ingeniero de desarrollo", "Jefe de Planta", etc.)
4. **Área**: Selecciona una de las áreas listadas arriba
5. **Estado Usuario**: Debe estar en **"Activo"** para que aparezca en el selector

### 3. Verificar Variables de Entorno (Opcional)

Si los nombres de tus campos en Airtable son diferentes, puedes configurar las variables de entorno en tu archivo `.env.local`:

```env
# Nombres de campos personalizados en Airtable
AIRTABLE_FIELD_NOMBRE=Nombre
AIRTABLE_FIELD_CEDULA=Cedula
AIRTABLE_FIELD_CARGO=Cargo
AIRTABLE_FIELD_AREA=Área
AIRTABLE_FIELD_ESTADO_USUARIO=Estado Usuario
```

Si no defines estas variables, el sistema usará los nombres por defecto listados arriba.

## Diagnóstico de Problemas

### 🔍 Endpoint de Diagnóstico

**NUEVO**: Ahora puedes usar el endpoint de diagnóstico para ver exactamente qué campos existen en tu Airtable:

1. **Abre tu navegador** y ve a: `http://localhost:3000/api/diagnostico-empleados`
2. **Verás un JSON** con:
   - ✅ Campos disponibles en tu tabla
   - ✅ Valores de ejemplo de los primeros registros
   - ✅ Configuración actual de variables de entorno
   - ✅ Recomendaciones específicas

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "diagnostico": {
    "totalRegistros": 10,
    "camposDisponibles": ["Nombre", "Cedula", "Position", "Area", "Estado Usuario"],
    "registrosEjemplo": [...]
  }
}
```

### El campo Área o Cargo aparece vacío

**Causa**: Los campos `Cargo` o `Área` no existen en Airtable o están vacíos para ese empleado.

**Solución**:
1. **Usa el endpoint de diagnóstico primero**: `http://localhost:3000/api/diagnostico-empleados`
2. Verifica los campos disponibles vs. los que la API está buscando
3. Abre la consola del navegador (F12 → Console)
4. Busca mensajes que empiecen con `⚠️` - te dirán exactamente qué empleados tienen datos faltantes
5. Completa los datos en Airtable

**Ejemplo de mensaje en consola**:
```
⚠️ 3 registros excluidos por falta de datos:
   - "Santiago Amaya": Falta(n) Cargo
   - "Luisa Ramirez": Falta(n) Área
   - "Juan Pérez": Falta(n) Cargo, Área

🔍 Campos disponibles en el primer registro de Airtable:
Nombre, Cedula, Position, Area, Estado Usuario, Categoria Usuario
```

### No aparecen empleados en el selector

**Causa 1**: Ningún empleado tiene el campo `Estado Usuario` en "Activo"
- **Solución**: Marca a los empleados que deben aparecer con estado "Activo"

**Causa 2**: Todos los empleados tienen campos incompletos
- **Solución**: Completa los campos Nombre, Cargo y Área para al menos un empleado

**Causa 3**: Error de conexión con Airtable
- **Solución**: Verifica las credenciales en `.env.local`:
  - `AIRTABLE_API_KEY`
  - `AIRTABLE_BASE_ID`
  - `AIRTABLE_TEAM_TABLE_NAME`

## Ejemplo de Registro Completo

```
Nombre: Hermes David Hernandez Garcia
Cedula: 1234567890
Cargo: Ingeniero de desarrollo
Área: RAAS
Estado Usuario: Activo
Categoria Usuario: Desarrollador (este campo ya existía)
```

## Detección Automática de Variaciones de Nombres

La API ahora intenta automáticamente **variaciones comunes** de nombres de campos:

### Campo "Cargo"
Busca en este orden:
1. `Cargo` (configurado o por defecto)
2. `Position`
3. `Posición`
4. `Titulo`
5. `Title`
6. `Puesto`

### Campo "Área"
Busca en este orden:
1. `Área` (configurado o por defecto)
2. `Area` (sin tilde)
3. `Área de trabajo`
4. `Department`
5. `Departamento`
6. `Division`

**Esto significa que:**
- ✅ No necesitas renombrar tus campos si ya usas nombres estándar en inglés o español
- ✅ La API funciona con la mayoría de configuraciones comunes sin configuración adicional
- ✅ Si usas nombres personalizados, solo necesitas configurar las variables de entorno

## Ventajas de Este Cambio

✅ **Sin hardcodeo**: Todos los datos vienen de Airtable  
✅ **Fácil mantenimiento**: Agregar/editar empleados solo requiere actualizar Airtable  
✅ **Consistencia**: Un solo lugar de verdad para los datos de empleados  
✅ **Diagnóstico**: Mensajes claros en consola indican qué datos faltan  
✅ **Escalable**: No es necesario modificar código para agregar empleados  
✅ **Flexible**: Detecta automáticamente variaciones comunes de nombres de campos  

## Soporte

Si después de completar los datos en Airtable el problema persiste:

1. Revisa la consola del navegador (F12 → Console)
2. Verifica los logs del servidor (terminal donde corre `npm run dev`)
3. Busca mensajes con `⚠️` o `❌` que indiquen el problema específico
