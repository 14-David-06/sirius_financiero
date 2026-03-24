# Skill: Patrones Airtable — Sirius Financiero

Conocimiento de dominio sobre la integración con Airtable en Sirius Financiero.

## Base de Datos Principal

| Variable de Entorno | Descripción |
|---|---|
| `AIRTABLE_BASE_ID` | Base principal financiera |
| `PIROLISIS_BALANCES_MASA_TABLE_ID` | Base separada para producción (Pirolisis) |

## Conexión con SDK Oficial

```typescript
// src/lib/airtable.ts
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

export default base;
```

## Tablas Principales

| Tabla | Variable ENV | Propósito |
|-------|-------------|----------|
| Equipo Financiero | `AIRTABLE_TEAM_TABLE_NAME` | Usuarios, auth, roles |
| Compras y Adquisiciones | `AIRTABLE_COMPRAS_TABLE_ID` | Solicitudes de compra |
| Items | `AIRTABLE_ITEMS_TABLE_ID` | Items de solicitudes |
| Cotizaciones | `AIRTABLE_COTIZACIONES_TABLE_ID` | Propuestas proveedores |
| Items Cotizados | `AIRTABLE_ITEMS_COTIZADOS_TABLE_ID` | Detalle cotizaciones |
| Caja Menor | `CAJA_MENOR_TABLE_ID` | Anticipos mensuales |
| Items Caja Menor | `ITEMS_CAJA_MENOR_TABLE_ID` | Gastos individuales |
| Movimientos Bancarios | `AIRTABLE_MOVIMIENTOS_TABLE_ID` | Transacciones |
| Facturación Ingresos | `AIRTABLE_INGRESOS_TABLE_ID` | Ventas |
| Conversaciones | `AIRTABLE_CONVERSACIONES_TABLE_ID` | Chat compras |
| Proveedores | `AIRTABLE_PROVEEDORES_TABLE_ID` | Base proveedores |
| Proyecciones | `AIRTABLE_PROYECCIONES_TABLE_ID` | Simulaciones |

## Patrón de Campos Dinámicos

**IMPORTANTE**: Todos los nombres de campos vienen de variables de entorno.

```typescript
// src/lib/config/airtable-fields.ts
export const getRequiredField = (envVar: string): string => {
  const value = process.env[envVar];
  if (!value) throw new Error(`Missing required env var: ${envVar}`);
  return value;
};

export const CAJA_MENOR_FIELDS = {
  FECHA_ANTICIPO: getRequiredField('FIELD_FECHA_ANTICIPO'),
  BENEFICIARIO: getRequiredField('FIELD_BENEFICIARIO'),
  CONCEPTO: getRequiredField('FIELD_CONCEPTO'),
  VALOR: getRequiredField('FIELD_VALOR'),
  ESTADO: getRequiredField('FIELD_ESTADO_CAJA_MENOR'),
};
```

**¿Por qué?**: Los nombres de campos en Airtable pueden tener espacios, tildes, etc. Mantenerlos en ENV permite:
- Cambiar nombres sin modificar código
- Evitar problemas de encoding
- Facilitar migraciones

## Consultas con SDK

### Listar todos los registros
```typescript
const records = await base(tableName)
  .select({
    view: 'Grid view',
    maxRecords: 100
  })
  .all();
```

### Filtrar con fórmula
```typescript
// SIEMPRE sanitizar input antes de usar en filterByFormula
import { SecurityMiddleware } from '@/lib/security';

const cedula = SecurityMiddleware.sanitizeInput(rawCedula);
if (!SecurityMiddleware.validateCedula(cedula)) {
  throw new Error('Cédula inválida');
}

const records = await base(TEAM_TABLE)
  .select({
    filterByFormula: `{${process.env.FIELD_CEDULA}} = "${cedula}"`,
    maxRecords: 1
  })
  .all();
```

### Crear registro
```typescript
const newRecord = await base(tableName).create([
  {
    fields: {
      [FIELDS.NOMBRE]: 'Valor',
      [FIELDS.FECHA]: new Date().toISOString(),
      [FIELDS.VALOR]: 150000,
    }
  }
]);
```

### Actualizar registro
```typescript
const updated = await base(tableName).update([
  {
    id: recordId,
    fields: {
      [FIELDS.ESTADO]: 'Aprobado',
      [FIELDS.FECHA_APROBACION]: new Date().toISOString(),
    }
  }
]);
```

### Eliminar registro (soft-delete recomendado)
```typescript
// Preferir soft-delete
const updated = await base(tableName).update([
  {
    id: recordId,
    fields: {
      [FIELDS.ESTADO]: 'Eliminado',
      [FIELDS.FECHA_ELIMINACION]: new Date().toISOString(),
    }
  }
]);

// Hard-delete (evitar en producción)
await base(tableName).destroy([recordId]);
```

## Relaciones entre Tablas

```
Equipo Financiero (usuarios)
├── Compras y Adquisiciones (1:N) — Solicitante
│   ├── Items (1:N) — Items de la solicitud
│   ├── Cotizaciones (1:N) — Propuestas de proveedores
│   │   └── Items Cotizados (1:N) — Detalle de cada cotización
│   └── Conversaciones (1:N) — Chat de la solicitud
├── Caja Menor (1:N) — Beneficiario del anticipo
│   └── Items Caja Menor (1:N) — Gastos del anticipo
└── Movimientos Bancarios (N:N) — Registros consolidados

Proveedores
├── Cotizaciones (1:N) — Cotizaciones del proveedor
└── Facturación Egresos (1:N) — Facturas del proveedor

Proyecciones (independiente)
└── Simulaciones financieras por año/semana
```

## Campos Comunes por Tabla

### Equipo Financiero (Auth)
| Campo | Tipo | Uso |
|-------|------|-----|
| Cedula | Text | Identificador único |
| Nombre | Text | Nombre completo |
| Hash | Text | Password hash (bcrypt) |
| Salt | Text | Salt para hash |
| Estado Usuario | Single Select | Activo / Inactivo |
| Categoria Usuario | Single Select | Colaborador / Admin / Gerencia / Dev |
| Email | Email | Correo corporativo |
| Cargo | Text | Cargo en la empresa |
| Area | Text | Área/departamento |

### Compras y Adquisiciones
| Campo | Tipo | Uso |
|-------|------|-----|
| ID Solicitud | Autonumber | Identificador único |
| Fecha Solicitud | Date | Fecha de creación |
| Solicitante | Link | Ref a Equipo Financiero |
| Estado Solicitud | Single Select | Pendiente / Aprobado / etc. |
| Prioridad | Single Select | Alta / Media / Baja |
| Items | Link | Ref a Items (múltiple) |
| Valor Total | Formula/Rollup | Suma de items |
| Centro de Costos | Single Select | Destino del gasto |

### Caja Menor
| Campo | Tipo | Uso |
|-------|------|-----|
| Fecha Anticipo | Date | Fecha del anticipo |
| Beneficiario | Link | Ref a Equipo Financiero |
| Valor Anticipo | Currency | Monto entregado |
| Estado | Single Select | Pendiente / Justificado / Consolidado |
| Items | Link | Ref a Items Caja Menor |
| Saldo Pendiente | Formula | Anticipo - gastos justificados |

## Manejo de Attachments

```typescript
// Los attachments en Airtable son arrays de objetos
interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  type: string;
  size: number;
}

// Agregar attachment (URL debe ser pública o pre-firmada)
const updated = await base(tableName).update([{
  id: recordId,
  fields: {
    'Documentos': [
      { url: 'https://s3.amazonaws.com/bucket/file.pdf' }
    ]
  }
}]);
```

## Paginación Manual (API REST)

Cuando necesitas más control que el SDK:

```typescript
let offset: string | undefined;
const allRecords: any[] = [];

do {
  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`);
  if (offset) url.searchParams.set('offset', offset);
  url.searchParams.set('pageSize', '100');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  
  const data = await res.json();
  allRecords.push(...data.records);
  offset = data.offset;
} while (offset);
```

## Errores Comunes

### "NOT_AUTHORIZED"
- Verificar que `AIRTABLE_API_KEY` tiene permisos en la base
- Verificar que `AIRTABLE_BASE_ID` es correcto

### "INVALID_FILTER_BY_FORMULA"
- Verificar sintaxis de la fórmula
- Usar comillas simples para strings: `{Campo} = 'valor'`
- Escapar caracteres especiales

### "UNKNOWN_FIELD_NAME"
- El campo no existe en la tabla
- El nombre del campo tiene espacios/tildes no manejados
- Usar variables de entorno para nombres de campos

### "TOO_MANY_REQUESTS" (Rate limit)
- Airtable permite 5 requests/segundo por base
- Implementar retry con exponential backoff
- Agrupar operaciones batch cuando sea posible
