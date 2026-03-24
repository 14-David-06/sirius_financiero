# Skill: Dominio Financiero — Sirius Financiero

Conocimiento del dominio financiero de Sirius Energy Group (empresa colombiana de energía).

## Módulos del Sistema

### 1. Solicitudes de Compra
Flujo de adquisición de bienes y servicios.

**Estados del flujo**:
```
Pendiente → En Revisión → Cotización → Aprobada → Orden Generada → Completada
                       ↘ Rechazada
```

**Roles**:
- **Colaborador**: Crea solicitudes, ve solo las propias
- **Administrador**: Revisa, aprueba, genera órdenes de compra
- **Gerencia**: Aprobación de montos altos, reportes

**Campos clave**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Centro de Costos | Select | Planta asignada (Pirolisis, Oficina, etc.) |
| Prioridad | Select | Alta / Media / Baja |
| Fecha Requerida | Date | Cuándo se necesita |
| Items | Linked | Productos/servicios solicitados |
| Cotizaciones | Linked | Propuestas de proveedores |

### 2. Caja Menor
Gestión de anticipos para gastos menores.

**Flujo**:
```
Anticipo Entregado → Gastos Registrados → Justificación → Consolidación → Cierre
```

**Campos clave**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Beneficiario | Link | Empleado que recibe anticipo |
| Valor Anticipo | Currency | Monto entregado (COP) |
| Items | Linked | Gastos individuales justificados |
| Saldo Pendiente | Formula | Anticipo - Σ gastos |
| Estado | Select | Pendiente / Justificado / Consolidado |

**Reglas de negocio**:
- Anticipo máximo: $500,000 COP por persona/mes
- Gastos deben tener soporte (factura/recibo)
- Consolidación mensual obligatoria

### 3. Facturación de Ingresos
Registro de ventas y cuentas por cobrar.

**Campos clave**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Cliente | Text | Nombre/NIT del cliente |
| Número Factura | Text | Consecutivo de facturación |
| Valor Base | Currency | Subtotal antes de impuestos |
| IVA | Currency | 19% sobre base gravada |
| Retención | Currency | Retención aplicada (si aplica) |
| Total | Formula | Base + IVA - Retención |
| Estado | Select | Pendiente / Pagada / Anulada |

**Retenciones colombianas**:
- **RETEIVA**: Retención de IVA (15% del IVA)
- **RETEFUENTE**: Según actividad económica (1% - 11%)
- **RETEICA**: Según municipio

### 4. Facturación de Egresos
Registro de gastos y cuentas por pagar.

**Integración con n8n**:
1. PDF de factura sube a OneDrive
2. n8n detecta archivo nuevo
3. OCR extrae datos de la factura
4. Callback a `/api/facturacion-egresos-callback`
5. Registro automático en Airtable

**Campos clave**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Proveedor | Link | Ref a base de proveedores |
| NIT | Text | Identificación tributaria |
| Valor | Currency | Total de la factura |
| Autoretenedor | Checkbox | Si el proveedor es autoretenedor |
| Estado | Select | Por pagar / Pagada / Anulada |

### 5. Movimientos Bancarios
Centralización de extractos de múltiples bancos.

**Bancos soportados**:
- Bancolombia
- BBVA

**Campos clave**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Fecha | Date | Fecha del movimiento |
| Banco | Select | Bancolombia / BBVA |
| Tipo | Select | Débito / Crédito |
| Valor | Currency | Monto del movimiento |
| Descripción | Text | Concepto/referencia |
| Saldo | Currency | Saldo después del movimiento |

### 6. Indicadores de Producción (Pirolisis)
Métricas de la planta de producción.

**KPIs**:
- Balance de masa (input vs output)
- Costos por semana
- Temperaturas de operación
- Eficiencia de producción

**Fuente de datos**: Base Airtable separada (`PIROLISIS_BALANCES_MASA_TABLE_ID`)

### 7. Simulador de Proyecciones
Pronósticos de flujo de caja.

**Variables**:
- Ingresos proyectados por semana
- Egresos fijos y variables
- Pagos programados
- Recaudos esperados

## Proveedores

**Campos del registro**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Razón Social | Text | Nombre legal |
| NIT | Text | Identificación tributaria |
| Autoretenedor | Checkbox | Si maneja retención propia |
| Tipo | Select | Persona Natural / Jurídica |
| Contacto | Text | Persona de contacto |
| Teléfono | Phone | Número de contacto |
| Email | Email | Correo electrónico |
| Banco | Text | Banco para pagos |
| Cuenta | Text | Número de cuenta |

## Calendario Fiscal Colombiano

| Fecha | Evento |
|-------|--------|
| Mensual | Declaración de retenciones |
| Bimestral | Declaración de IVA (según régimen) |
| Trimestral | Anticipo de renta |
| Anual (Mar-Abr) | Declaración de renta |
| Anual (Ene) | Información exógena |

## Centros de Costo

Clasificación de gastos por área/planta:

| Centro | Código | Descripción |
|--------|--------|-------------|
| Pirolisis | PYR | Planta de producción |
| Oficina Principal | OFC | Gastos administrativos |
| Comercial | COM | Ventas y marketing |
| Transporte | TRP | Logística |
| Mantenimiento | MNT | Reparaciones y soporte |

## Agentes IA del Sistema

### Caja Menor Agent
**Modelo**: OpenAI GPT-4o-mini
**Función**: Análisis conversacional de gastos de caja menor
**Contexto**: Recibe datos de anticipos, gastos, saldos

**Ejemplo de consultas**:
- "¿Cuánto he gastado este mes?"
- "¿Cuál es mi saldo pendiente?"
- "¿Qué gastos tengo sin justificar?"
- "Analiza mis tendencias de gasto"

### Transcripción de Audio
**Modelo**: OpenAI Whisper-1
**Idioma**: Español colombiano
**Uso**: Crear solicitudes de compra por voz

**Formato de salida**: Texto plano transcrito, que el usuario puede editar antes de enviar.

## Integraciones Externas

### OneDrive (Microsoft Graph)
- Almacenamiento de facturas de ingresos/egresos
- Estructura de carpetas: `/General/Documentos Soporte/{año}/{tipo}/`
- Autenticación: OAuth 2.0 Client Credentials

### AWS S3
- PDFs consolidados de caja menor
- Documentos de cotizaciones
- URLs pre-firmadas para descarga

### n8n
- Automatización de procesamiento de facturas
- Webhook-based: evento → proceso → callback
- OCR de PDFs de factura

## Validaciones de Negocio

### Cédula colombiana
- Formato: 6-12 dígitos
- Validación: `/^\d{6,12}$/`

### NIT colombiano
- Formato: 9-10 dígitos + dígito verificación
- Ejemplo: 900123456-1

### Moneda
- Todas las cantidades en COP (Peso colombiano)
- Sin decimales para la mayoría de transacciones
- Formato display: $1.234.567

### Fechas
- Formato Airtable: ISO 8601 (YYYY-MM-DD)
- Display: DD/MM/YYYY (formato colombiano)
- Zona horaria: America/Bogota (UTC-5)
