# Análisis del Flujo de Ingreso a Inventario (Warehouse)

**Fecha:** 2026-03-27
**Analista:** Claude Code
**Estado:** Diagnóstico completo — Listo para implementación

---

## 📋 Resumen Ejecutivo

El flujo de ingreso a inventario requiere implementar un sistema de custodia en 3 fases:
1. **Admin Financiero** → Genera Orden de Compra (OC) ✅ YA IMPLEMENTADO
2. **Almacenista** → Recibe físicamente y registra en "En Espera" ❌ POR IMPLEMENTAR
3. **Usuario Autorizado** → Confirma y actualiza stock definitivo ❌ POR IMPLEMENTAR

---

## 🔍 Diagnóstico del Sistema Actual

### ✅ Lo que YA existe

#### 1. Generación de Órdenes de Compra
- **Endpoint:** `POST /api/generate-orden-compra`
- **Ubicación:** `src/app/api/generate-orden-compra/route.ts`
- **Funcionalidad:**
  - Genera PDF de OC con datos de cotización aprobada
  - Crea registro en tabla "Ordenes de Compra" (Airtable)
  - Crea items en tabla "Items Orden de Compra"
  - Estado inicial: **"Emitida"**
  - Sube PDF a AWS S3
  - Vincula OC con solicitud de compra y cotización

#### 2. Tablas en Airtable
| Tabla | ID | Estado | Campos |
|-------|-----|--------|---------|
| Ordenes de Compra | `tblXXXXXXXXXXXXX04` | ✅ Existe | 21 campos |
| Items Orden de Compra | `tblXXXXXXXXXXXXX05` | ✅ Existe | 11 campos |

**Campos clave en "Ordenes de Compra":**
- `ID Orden de Compra` (singleLineText)
- `Estado Orden de Compra` (singleSelect) — Valores actuales: Emitida
- `Fecha de Emisión` (date)
- `Proveedor` (multipleRecordLinks)
- `Compra Relacionada` (multipleRecordLinks)
- `Cotización Relacionada` (multipleRecordLinks)
- `Items Orden de Compra` (multipleRecordLinks)
- `Subtotal`, `IVA`, `Retencion`, `Total Neto`

**Campos clave en "Items Orden de Compra":**
- `ID Item OC` (singleLineText)
- `Orden de Compra Relacionada` (multipleRecordLinks)
- `Descripcion del Item` (singleLineText)
- `Cantidad` (number)
- `Unidad de Medida` (singleSelect)
- `Valor Unitario` (currency)
- `Item Compra Relacionado` (multipleRecordLinks)
- `Item Cotizado Relacionado` (multipleRecordLinks)

---

### ✅ Lo que SÍ existe (Base Sirius Insumos Core)

#### Tablas de Inventario en Base Separada
**Base:** Sirius Insumos Core (`appXXXXXXXXXXXXX02`)
**Variable .env:** `AIRTABLE_INS_BASE_ID=appXXXXXXXXXXXXX02`

| Variable .env | Table ID | Nombre | Estado |
|---------------|----------|--------|--------|
| `AIRTABLE_INS_TABLE_ID` | `tblXXXXXXXXXXXXX06` | Insumo (Catálogo) | ✅ EXISTE |
| `AIRTABLE_CAT_INSUMO_TABLE_ID` | `tblXXXXXXXXXXXXX07` | Categoria Insumo | ✅ EXISTE |
| `AIRTABLE_MOV_INSUMO_TABLE_ID` | `tblXXXXXXXXXXXXX08` | Movimientos Insumos | ✅ EXISTE |
| `AIRTABLE_STOCK_INSUMO_TABLE_ID` | `tblXXXXXXXXXXXXX09` | Stock Insumos | ✅ EXISTE |
| `AIRTABLE_UNIDADES_TABLE_ID` | `tblXXXXXXXXXXXXX10` | Unidades de Medida | ✅ EXISTE |
| `AIRTABLE_AREAS_TABLE_ID` | `tblXXXXXXXXXXXXX11` | Areas | ✅ EXISTE |

**✅ ESTRUCTURA COMPLETA:** Ver detalles en [`docs/estructura-inventario-real.md`](./estructura-inventario-real.md)

**Características avanzadas ya implementadas en Airtable:**
- ✅ Sistema de conversión de unidades (original → base)
- ✅ Cálculo automático de costos unitarios y totales
- ✅ Control de lotes y fechas de vencimiento
- ✅ Áreas de origen/destino
- ✅ Estados de movimiento: "En Espera", "Confirmado"
- ✅ Stock calculado por fórmula (no manual)

---

### ❌ Lo que NO existe (Blockers reales)

#### 1. Endpoints de Gestión de OC (Prerrequisitos B1, B2)
- ❌ `GET /api/ordenes-compra` — Necesario para panel del almacenista
- ❌ `PATCH /api/ordenes-compra/[id]/estado` — Necesario para transiciones de estado

#### 2. Rol "Almacenista" (Prerrequisito B3)
- ❌ No existe en campo "Categoria Usuario" de tabla "Equipo Financiero"
- ❌ No configurado en `middleware.ts`
- **Roles actuales:** Desarrollador, Gerencia, Administrador, Colaborador

#### 3. Módulo Warehouse
- ❌ No existe `/api/warehouse/`
- ❌ No existe componente frontend de almacenista
- ❌ No hay tipos TypeScript para inventario

#### 4. Variables .env Faltantes
- ❌ Campos adicionales de Movimientos Insumos no mapeados:
  - Estado Entrada Insumo
  - Subtipo
  - Cantidad Original / Unidad Original
  - Costo Unitario / Costo Total
  - Documento Origen
  - ID Solicitud Compra
  - Area Destino Link
  - Lote / Fecha Vencimiento
  - Notas

---

## 📊 Estructura de Tablas Requeridas

### Tabla: Movimientos Insumos
**Propósito:** Registrar cada movimiento de entrada/salida de insumos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ID Movimiento | autoNumber | Identificador único |
| Tipo Movimiento | singleSelect | "Ingreso", "Salida", "Ajuste" |
| Estado Movimiento | singleSelect | "En Espera", "Confirmado", "Rechazado" |
| Orden de Compra | multipleRecordLinks | → Ordenes de Compra |
| Item OC | multipleRecordLinks | → Items Orden de Compra |
| Insumo | singleLineText | Descripción del insumo |
| Cantidad | number | Cantidad física recibida |
| Unidad Medida | singleSelect | kg, L, unidades, etc. |
| Área Destino | singleSelect | BODEGA, LABORATORIO, PIROLISIS, ADMINISTRACIÓN |
| Fecha Recepción | date | Fecha física de recepción |
| Recibido Por | singleLineText | Nombre del almacenista |
| Confirmado Por | singleLineText | Usuario que autorizó |
| Fecha Confirmación | date | Fecha de confirmación |
| Observaciones | multilineText | Notas, diferencias, etc. |
| Stock Actualizado | multipleRecordLinks | → Stock Insumos (al confirmar) |

### Tabla: Stock Insumos
**Propósito:** Inventario actual consolidado por insumo y área

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ID Stock | autoNumber | Identificador único |
| Insumo | singleLineText | Nombre del insumo |
| Categoría | singleSelect | Materia prima, empaque, químico, etc. |
| Área | singleSelect | BODEGA, LABORATORIO, PIROLISIS, ADMINISTRACIÓN |
| Cantidad Actual | number | Stock disponible |
| Unidad Medida | singleSelect | kg, L, unidades, etc. |
| Stock Mínimo | number | Punto de reorden |
| Stock Máximo | number | Capacidad máxima |
| Última Actualización | lastModifiedTime | Timestamp |
| Movimientos | multipleRecordLinks | → Movimientos Insumos |
| Costo Promedio | currency | Costo promedio ponderado |
| Valor Total | formula | Cantidad × Costo Promedio |

---

## 🔄 Flujo de Estados de Orden de Compra

```
[Emitida] → [En Tránsito] → [Recibida] → [Ingresada a Inventario]
    ↓            ↓              ↓                  ↓
Admin      Almacenista    Almacenista      Usuario Autorizado
Genera OC   Marca envío  Recibe física    Confirma stock
```

**Valores requeridos para campo "Estado Orden de Compra":**
1. `Emitida` (actual)
2. `En Tránsito` (nuevo)
3. `Recibida` (nuevo)
4. `Ingresada a Inventario` (nuevo)
5. `Cancelada` (nuevo)

---

## 🛠️ Plan de Implementación

### Fase 0: Preparación de Airtable (Manual)
**Responsable:** Usuario o Admin de Airtable
**Tiempo estimado:** 15-20 minutos
**Estado:** ✅ Tablas de inventario YA EXISTEN — Solo ajustes necesarios

1. **✅ SKIP — Tablas ya existen:**
   - ✅ Movimientos Insumos (base Sirius Insumos Core)
   - ✅ Stock Insumos (base Sirius Insumos Core)
   - ✅ Sistema completo de unidades, áreas y conversión

2. **⚠️ Agregar variables .env.local faltantes:**
   ```env
   # Campos adicionales de Movimientos Insumos
   AIRTABLE_MOV_ESTADO_FIELD=Estado Entrada Insumo
   AIRTABLE_MOV_SUBTIPO_FIELD=Subtipo
   AIRTABLE_MOV_CANTIDAD_ORIGINAL_FIELD=Cantidad Original
   AIRTABLE_MOV_UNIDAD_ORIGINAL_FIELD=Unidad Original
   AIRTABLE_MOV_COSTO_UNITARIO_FIELD=Costo Unitario
   AIRTABLE_MOV_COSTO_TOTAL_FIELD=Costo Total
   AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD=Documento Origen
   AIRTABLE_MOV_ID_SOLICITUD_FIELD=ID Solicitud Compra
   AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD=Area Destino Link
   AIRTABLE_MOV_LOTE_FIELD=Lote
   AIRTABLE_MOV_FECHA_VENC_FIELD=Fecha Vencimiento
   AIRTABLE_MOV_NOTAS_FIELD=Notas
   ```

3. **Agregar valores al campo "Estado Orden de Compra":**
   - En tabla "Ordenes de Compra" (base financiera), campo singleSelect
   - Agregar: "En Tránsito", "Recibida", "Ingresada a Inventario", "Cancelada"

4. **Agregar rol "Almacenista":**
   - En tabla "Equipo Financiero" (base financiera), campo "Categoria Usuario"
   - Agregar valor: "Almacenista"

---

### Fase 1: Endpoints de Órdenes de Compra
**Archivos a crear:**
- `src/app/api/ordenes-compra/route.ts` (GET)
- `src/app/api/ordenes-compra/[id]/estado/route.ts` (PATCH)

**Funcionalidad GET:**
```typescript
GET /api/ordenes-compra?estado=Emitida&proveedor=xxx&desde=2026-01-01&hasta=2026-03-27
```
- Listar OCs con filtros
- Incluir items relacionados
- Ordenar por fecha de emisión desc
- Rate limiting: 20 req/min

**Funcionalidad PATCH:**
```typescript
PATCH /api/ordenes-compra/[id]/estado
Body: { nuevoEstado: "En Tránsito", comentarios: "..." }
```
- Validar transiciones de estado válidas
- Registrar en Bitacora Financiera
- Solo roles autorizados (Administrador, Gerencia, Desarrollador, Almacenista)

---

### Fase 2: Configuración de Rol Almacenista
**Archivos a modificar:**
- `middleware.ts` (línea 100, 114)

**Cambios:**
1. Agregar rutas protegidas:
   ```typescript
   const warehouseRoutes = [
     '/warehouse',
     '/recepcion-almacen',
   ];
   ```

2. Permitir acceso a almacenistas:
   ```typescript
   const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador', 'Almacenista'];
   ```

3. Bloquear colaboradores de rutas warehouse

---

### Fase 3: Tipos TypeScript
**Archivo a crear:**
- `src/types/inventario.ts`

**Tipos requeridos:**
```typescript
export interface OrdenCompraCompleta {
  id: string;
  idOrdenCompra: string;
  fechaEmision: string;
  estadoOC: 'Emitida' | 'En Tránsito' | 'Recibida' | 'Ingresada a Inventario' | 'Cancelada';
  proveedor: string;
  items: ItemOCCompleto[];
  subtotal: number;
  iva: number;
  retencion: number;
  totalNeto: number;
  documentoUrl: string;
}

export interface ItemOCCompleto {
  id: string;
  idItemOC: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  valorUnitario: number;
  ordenCompraId: string;
}

export interface MovimientoInsumo {
  id: string;
  tipoMovimiento: 'Ingreso' | 'Salida' | 'Ajuste';
  estadoMovimiento: 'En Espera' | 'Confirmado' | 'Rechazado';
  ordenCompraId?: string;
  itemOCId?: string;
  insumo: string;
  cantidad: number;
  unidadMedida: string;
  areaDestino: 'BODEGA' | 'LABORATORIO' | 'PIROLISIS' | 'ADMINISTRACIÓN';
  fechaRecepcion: string;
  recibidoPor: string;
  confirmadoPor?: string;
  fechaConfirmacion?: string;
  observaciones?: string;
}

export interface StockInsumo {
  id: string;
  insumo: string;
  categoria: string;
  area: 'BODEGA' | 'LABORATORIO' | 'PIROLISIS' | 'ADMINISTRACIÓN';
  cantidadActual: number;
  unidadMedida: string;
  stockMinimo: number;
  stockMaximo: number;
  costoPromedio: number;
  valorTotal: number;
}
```

---

### Fase 4: API Warehouse
**Archivos a crear:**
- `src/app/api/warehouse/movimientos/route.ts` (POST, GET)
- `src/app/api/warehouse/movimientos/[id]/confirmar/route.ts` (PATCH)
- `src/app/api/warehouse/stock/route.ts` (GET)

**Endpoint 1: Crear movimiento en "En Espera"**
```typescript
POST /api/warehouse/movimientos
Body: {
  ordenCompraId: "rec...",
  items: [
    {
      itemOCId: "rec...",
      cantidadRecibida: 50,
      areaDestino: "BODEGA",
      observaciones: "Empaque en buen estado"
    }
  ]
}
```

**Lógica:**
1. Verificar que OC exista y esté en estado "En Tránsito" o "Recibida"
2. Crear registros en "Movimientos Insumos" con estado "En Espera"
3. NO actualizar stock todavía
4. Actualizar estado OC a "Recibida" si todos los items fueron procesados
5. Registrar en Bitacora

**Endpoint 2: Confirmar movimiento y actualizar stock**
```typescript
PATCH /api/warehouse/movimientos/[id]/confirmar
Body: {
  confirmarMovimiento: true,
  observacionesFinales: "Stock verificado"
}
```

**Lógica:**
1. Verificar permisos (solo Administrador, Gerencia, Desarrollador)
2. Validar que movimiento esté en "En Espera"
3. Actualizar estado a "Confirmado"
4. Actualizar o crear registro en "Stock Insumos":
   - Si existe: Cantidad Actual += Cantidad Movimiento
   - Si no existe: Crear nuevo registro
5. Actualizar costo promedio ponderado
6. Actualizar estado OC a "Ingresada a Inventario" si todos los movimientos confirmados
7. Registrar en Bitacora

**Endpoint 3: Consultar stock**
```typescript
GET /api/warehouse/stock?area=BODEGA&insumo=xxx&bajoMinimo=true
```

---

### Fase 5: Frontend Almacenista
**Componentes a crear:**
- `src/components/RecepcionAlmacen.tsx`
- `src/components/ConfirmacionStock.tsx`
- `src/app/recepcion-almacen/page.tsx`

**Funcionalidades:**
1. **Panel del almacenista:**
   - Listar OCs en estado "Emitida" o "En Tránsito"
   - Filtrar por proveedor, fecha, prioridad
   - Ver detalles de items de cada OC

2. **Formulario de recepción:**
   - Seleccionar OC
   - Marcar items recibidos
   - Ingresar cantidad física (puede diferir de la pedida)
   - Seleccionar área de destino por item
   - Campo de observaciones (faltantes, sobrantes, daños)
   - Botón "Registrar Recepción" → crea movimientos en "En Espera"

3. **Panel de confirmación (roles elevados):**
   - Listar movimientos en "En Espera"
   - Revisar diferencias entre pedido vs recibido
   - Botón "Confirmar e Ingresar a Stock"
   - Botón "Rechazar" (con motivo)

---

## 🔒 Consideraciones de Seguridad

### Control de Acceso por Fase
| Acción | Roles Permitidos |
|--------|------------------|
| Ver OCs emitidas | Almacenista, Administrador, Gerencia, Desarrollador |
| Registrar recepción física | Almacenista, Administrador, Gerencia, Desarrollador |
| Confirmar ingreso a stock | Administrador, Gerencia, Desarrollador |
| Consultar stock | Todos (según área asignada) |

### Validaciones Críticas
1. **Transiciones de estado OC:**
   - Solo permitir secuencia lógica (no saltar estados)
   - Registrar quién y cuándo cambió estado

2. **Movimientos de inventario:**
   - Evitar doble confirmación
   - Validar cantidades positivas
   - No permitir movimientos sin OC origen (ingresos)
   - Rechazar movimientos de salida si stock insuficiente

3. **Auditoría:**
   - Registrar TODOS los cambios de stock en Bitacora
   - Incluir: usuario, fecha, antes/después, motivo

---

## 📈 Métricas de Éxito

1. **Trazabilidad completa:** OC → Movimiento → Stock
2. **Sin escrituras directas a stock:** Solo a través de movimientos confirmados
3. **Diferencias documentadas:** Registro de discrepancias pedido vs recibido
4. **Auditoría completa:** Log de todos los cambios con responsable

---

## 🚧 Riesgos Identificados

### ~~Riesgo 1: Tablas de inventario no existen~~ ✅ RESUELTO
**Estado:** Las tablas existen en base "Sirius Insumos Core"
**Impacto:** Ninguno — Sistema de inventario completo y funcional

### Riesgo 2: Rol Almacenista no configurado
**Impacto:** Alto — Sin control de acceso
**Mitigación:** Actualizar Airtable y middleware antes de despliegue

### Riesgo 3: Estados de OC no ampliados
**Impacto:** Alto — Flujo incompleto
**Mitigación:** Agregar valores a singleSelect en Airtable (Fase 0)

### Riesgo 4: Concurrencia en actualización de stock
**Impacto:** Medio — Posibles inconsistencias
**Mitigación:** Usar transacciones o bloqueos optimistas en confirmación

---

## ✅ Checklist de Implementación

### Preparación (Airtable — Manual)
- [x] ~~Crear tabla "Movimientos Insumos"~~ ✅ YA EXISTE en Sirius Insumos Core
- [x] ~~Crear tabla "Stock Insumos"~~ ✅ YA EXISTE en Sirius Insumos Core
- [x] ~~Actualizar .env.local con IDs de tablas~~ ✅ YA CONFIGURADO
- [ ] Agregar variables .env faltantes (campos adicionales de Movimientos)
- [ ] Agregar estados a campo "Estado Orden de Compra"
- [ ] Agregar rol "Almacenista" a "Equipo Financiero"

### Backend
- [ ] Crear tipos en `src/types/inventario.ts`
- [ ] Implementar `GET /api/ordenes-compra`
- [ ] Implementar `PATCH /api/ordenes-compra/[id]/estado`
- [ ] Implementar `POST /api/warehouse/movimientos`
- [ ] Implementar `PATCH /api/warehouse/movimientos/[id]/confirmar`
- [ ] Implementar `GET /api/warehouse/stock`
- [ ] Actualizar `middleware.ts` con rol Almacenista

### Frontend
- [ ] Crear componente `RecepcionAlmacen.tsx`
- [ ] Crear componente `ConfirmacionStock.tsx`
- [ ] Crear página `/recepcion-almacen`
- [ ] Agregar link en Navbar para almacenistas
- [ ] Agregar notificaciones para movimientos pendientes

### Testing
- [ ] Test unitario: Crear movimiento en "En Espera"
- [ ] Test unitario: Confirmar movimiento y actualizar stock
- [ ] Test integración: Flujo completo OC → Recepción → Stock
- [ ] Test seguridad: Validar permisos por rol
- [ ] Test edge case: Diferencias pedido vs recibido

### Documentación
- [ ] Actualizar CLAUDE.md con nuevas rutas
- [ ] Crear doc de usuario para almacenistas
- [ ] Documentar API en Postman/Swagger
- [ ] Agregar diagrama de flujo al README

---

## 📞 Próximos Pasos

1. **Validar con el usuario:**
   - Confirmar estructura de tablas propuesta
   - Validar flujo de estados de OC
   - Aprobar permisos por rol

2. **Ejecutar Fase 0 (Airtable):**
   - Crear tablas manualmente o usar Airtable MCP
   - Actualizar .env.local
   - Verificar configuraciones

3. **Iniciar desarrollo:**
   - Comenzar con endpoints de OC (Fase 1)
   - Continuar con warehouse API (Fase 4)
   - Finalizar con frontend (Fase 5)

---

**Documento generado por:** Claude Code
**Última actualización:** 2026-03-27
