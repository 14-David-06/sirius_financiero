# Estructura Real del Sistema de Inventario (Sirius Insumos Core)

**Base de Airtable:** Sirius Insumos Core
**Base ID:** `appXXXXXXXXXXXXX02`
**Variable .env:** `AIRTABLE_INS_BASE_ID`
**Estado:** ✅ **TODAS LAS TABLAS EXISTEN Y ESTÁN CONFIGURADAS**

---

## ✅ Configuración Verificada

### Variables de Entorno (.env.local)
```env
# Base de datos separada para inventario
AIRTABLE_INS_BASE_ID=appXXXXXXXXXXXXX02

# IDs de Tablas (TODOS VÁLIDOS)
AIRTABLE_INS_TABLE_ID=tblXXXXXXXXXXXXX06          # Catálogo Insumos
AIRTABLE_CAT_INSUMO_TABLE_ID=tblXXXXXXXXXXXXX07   # Categorías
AIRTABLE_MOV_INSUMO_TABLE_ID=tblXXXXXXXXXXXXX08   # Movimientos
AIRTABLE_STOCK_INSUMO_TABLE_ID=tblXXXXXXXXXXXXX09 # Stock
AIRTABLE_UNIDADES_TABLE_ID=tblXXXXXXXXXXXXX10     # Unidades de Medida
AIRTABLE_AREAS_TABLE_ID=tblXXXXXXXXXXXXX11        # Áreas
```

---

## 📊 Estructura de Tablas

### 1. Insumo (Catálogo) — `tblXXXXXXXXXXXXX06`
**Propósito:** Catálogo maestro de insumos

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| Código SIRIUS-INS | `fldXXXXXXXXXXXXX01` | formula | Formato: SIRIUS-INS-XXXX |
| ID | `fldXXXXXXXXXXXXX02` | autoNumber | Identificador único |
| Nombre | `fldXXXXXXXXXXXXX03` | singleLineText | Nombre del insumo |
| Unidad Medida | `fldXXXXXXXXXXXXX04` | singleLineText | Unidad de medida |
| Stock Minimo | `fldXXXXXXXXXXXXX05` | number | Punto de reorden |
| Estado Insumo | `fldXXXXXXXXXXXXX06` | singleSelect | Activo/Inactivo |
| Imagen Referencia | `fldXXXXXXXXXXXXX07` | multipleAttachments | Fotos del producto |
| ID Area Origen | `fldXXXXXXXXXXXXX08` | singleLineText | Área principal |
| Ficha Tecnica | `fldXXXXXXXXXXXXX09` | multilineText | Especificaciones |
| Referencia Comercial | `fldXXXXXXXXXXXXX10` | aiText | Descripción IA |
| ID Creador Core | `fldXXXXXXXXXXXXX11` | multilineText | Usuario creador |
| Categoria | `fldXXXXXXXXXXXXX12` | multipleRecordLinks | → Categoria Insumo |
| Movimientos Insumos | `fldXXXXXXXXXXXXX13` | multipleRecordLinks | → Movimientos |
| Stock Insumos | `fldXXXXXXXXXXXXX14` | multipleRecordLinks | → Stock |
| Unidad Base | `fldXXXXXXXXXXXXX15` | multipleRecordLinks | → Unidades de Medida |

---

### 2. Movimientos Insumos — `tblXXXXXXXXXXXXX08`
**Propósito:** Registro de todos los movimientos (ingresos/salidas)

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| **Identificación** ||||
| Código Movimiento Insumo | `fldXXXXXXXXXXXXX16` | formula | MOV-INS-XXXX |
| ID | `fldXXXXXXXXXXXXX17` | autoNumber | Identificador |
| Creada | `fldXXXXXXXXXXXXX18` | createdTime | Timestamp creación |
| Última modificación | `fldXXXXXXXXXXXXX19` | lastModifiedTime | Timestamp última edición |
| **Movimiento** ||||
| Name | `fldXXXXXXXXXXXXX20` | singleLineText | Descripción corta |
| Tipo Movimiento | `fldXXXXXXXXXXXXX21` | singleSelect | Ingreso/Salida/Ajuste |
| Subtipo | `fldXXXXXXXXXXXXX22` | singleSelect | Compra/Producción/etc |
| Estado Entrada Insumo | `fldXXXXXXXXXXXXX23` | singleSelect | ⚠️ **En Espera/Confirmado** |
| **Cantidad y Unidades** ||||
| Cantidad Original | `fldXXXXXXXXXXXXX24` | number | En unidad de compra |
| Unidad Original | `fldXXXXXXXXXXXXX25` | multipleRecordLinks | → Unidades de Medida |
| Factor Conversion | `fldXXXXXXXXXXXXX26` | number | Factor a unidad base |
| Cantidad Base | `fldXXXXXXXXXXXXX27` | number | Cantidad × Factor |
| Cantidad  | `fldXXXXXXXXXXXXX28` | number | (campo legacy) |
| **Costos** ||||
| Costo Unitario | `fldXXXXXXXXXXXXX29` | currency | Precio por unidad original |
| Costo Total | `fldXXXXXXXXXXXXX30` | currency | Cantidad × Costo |
| Costo Unitario Base | `fldXXXXXXXXXXXXX31` | currency | Costo / Cantidad Base |
| **Trazabilidad** ||||
| Insumo | `fldXXXXXXXXXXXXX32` | multipleRecordLinks | → Insumo |
| ID Responsable Core | `fldXXXXXXXXXXXXX33` | singleLineText | Usuario ejecutor |
| Documento Origen | `fldXXXXXXXXXXXXX34` | singleLineText | Nro factura/OC |
| ID Solicitud Compra | `fldXXXXXXXXXXXXX35` | singleLineText | Link a compra |
| **Ubicaciones** ||||
| ID Area Origen | `fldXXXXXXXXXXXXX36` | singleLineText | Área origen |
| ID Area Destino | `fldXXXXXXXXXXXXX37` | singleLineText | Área destino |
| Area Origen Link | `fldXXXXXXXXXXXXX38` | multipleRecordLinks | → Areas |
| Area Destino Link | `fldXXXXXXXXXXXXX39` | multipleRecordLinks | → Areas |
| **Lote y Control** ||||
| Lote | `fldXXXXXXXXXXXXX40` | singleLineText | Número de lote |
| Fecha Vencimiento | `fldXXXXXXXXXXXXX41` | date | Vencimiento del lote |
| Notas | `fldXXXXXXXXXXXXX42` | multilineText | Observaciones |
| **Relaciones** ||||
| Stock Insumos | `fldXXXXXXXXXXXXX43` | multipleRecordLinks | → Stock |

---

### 3. Stock Insumos — `tblXXXXXXXXXXXXX09`
**Propósito:** Inventario actual consolidado por insumo × área

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| id_stock | `fldXXXXXXXXXXXXX44` | formula | INV-STOCK-INS-XXXX |
| ID | `fldXXXXXXXXXXXXX45` | autoNumber | Identificador |
| stock_actual | `fldXXXXXXXXXXXXX46` | formula | **Ingresos - Salidas** |
| Ultima Actualizacion | `fldXXXXXXXXXXXXX47` | lastModifiedTime | Timestamp |
| Cantidad Ingresa | `fldXXXXXXXXXXXXX48` | multipleLookupValues | Suma ingresos |
| Cantidad Sale | `fldXXXXXXXXXXXXX49` | multipleLookupValues | Suma salidas |
| Insumo ID | `fldXXXXXXXXXXXXX50` | multipleRecordLinks | → Insumo |
| Movimiento Insumo ID | `fldXXXXXXXXXXXXX51` | multipleRecordLinks | → Movimientos |
| Area | `fldXXXXXXXXXXXXX52` | multipleRecordLinks | → Areas |
| Costo Acumulado | `fldXXXXXXXXXXXXX53` | currency | Valor del stock |

**⚠️ IMPORTANTE:** El campo `stock_actual` es una **fórmula** que calcula automáticamente el stock basándose en los movimientos vinculados. No se actualiza manualmente.

---

### 4. Areas — `tblXXXXXXXXXXXXX11`
**Propósito:** Catálogo de áreas físicas

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| ID Core | `fldXXXXXXXXXXXXX54` | multilineText | ID único |
| Nombre | `fldXXXXXXXXXXXXX55` | singleLineText | BODEGA, LAB, etc |
| Responsable | `fldXXXXXXXXXXXXX56` | multilineText | Encargado |
| Activa | `fldXXXXXXXXXXXXX57` | checkbox | Si está operativa |
| Movimientos (origen) | `fldXXXXXXXXXXXXX58` | multipleRecordLinks | → Movimientos |
| Movimientos (destino) | `fldXXXXXXXXXXXXX59` | multipleRecordLinks | → Movimientos |
| Stock Insumos | `fldXXXXXXXXXXXXX60` | multipleRecordLinks | → Stock |

---

### 5. Unidades de Medida — `tblXXXXXXXXXXXXX10`
**Propósito:** Catálogo de unidades y conversiones

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| Nombre | `fldXXXXXXXXXXXXX61` | singleLineText | Nombre completo |
| Simbolo | `fldXXXXXXXXXXXXX62` | singleLineText | g, kg, L, ml, und |
| Tipo | `fldXXXXXXXXXXXXX63` | singleSelect | Masa/Volumen/Conteo |
| Factor a Base | `fldXXXXXXXXXXXXX64` | number | Factor conversión |
| Unidad Base de Tipo | `fldXXXXXXXXXXXXX65` | singleLineText | g, ml, oder und |
| Insumo | `fldXXXXXXXXXXXXX66` | multipleRecordLinks | → Insumo |
| Movimientos Insumos | `fldXXXXXXXXXXXXX67` | multipleRecordLinks | → Movimientos |

**Ejemplo:** 1 kg → Factor 1000 → 1000 g (unidad base)

---

### 6. Categoria Insumo — `tblXXXXXXXXXXXXX07`
**Propósito:** Clasificación de insumos

| Campo | ID | Tipo | Descripción |
|-------|-----|------|-------------|
| Código CAT-INS | `fldXXXXXXXXXXXXX68` | formula | CAT-INS-XXXX |
| ID | `fldXXXXXXXXXXXXX69` | autoNumber | Identificador |
| Tipo de insumo | `fldXXXXXXXXXXXXX70` | singleLineText | Categoría |
| Descripción | `fldXXXXXXXXXXXXX71` | multilineText | Detalle |
| Insumo | `fldXXXXXXXXXXXXX72` | multipleRecordLinks | → Insumo |

---

## 🔄 Flujo de Ingreso Real (Con estructura existente)

### Paso 1: Almacenista recibe físicamente
```typescript
POST /api/warehouse/movimientos
Body: {
  ordenCompraId: "recXXX", // OC de base financiera
  items: [
    {
      insumoId: "recYYY",        // → Insumo (base insumos)
      cantidadOriginal: 5,       // Cantidad recibida
      unidadOriginalId: "recZZZ", // → Unidades de Medida
      areaDestinoId: "recAAA",   // → Areas
      costoUnitario: 50000,
      documentoOrigen: "FACT-2024-001",
      lote: "LOT-2024-03-001",
      fechaVencimiento: "2025-03-27",
      notas: "Empaque en buen estado"
    }
  ]
}
```

**Crea en Movimientos Insumos:**
- Tipo Movimiento: "Ingreso"
- Subtipo: "Compra"
- Estado Entrada Insumo: **"En Espera"** ⚠️
- Calcula automáticamente Cantidad Base usando Factor Conversion
- Calcula Costo Total y Costo Unitario Base
- NO actualiza Stock todavía (el stock es fórmula)

### Paso 2: Usuario autorizado confirma
```typescript
PATCH /api/warehouse/movimientos/{movimientoId}/confirmar
Body: {
  confirmar: true,
  observacionesFinales: "Stock verificado"
}
```

**Actualiza Movimientos Insumos:**
- Estado Entrada Insumo: "En Espera" → **"Confirmado"**
- Vincula a registro de Stock Insumos (crea si no existe)

**El Stock se actualiza AUTOMÁTICAMENTE** porque:
- `stock_actual` es fórmula: `SUM(Cantidad Ingresa) - SUM(Cantidad Sale)`
- Al cambiar estado a "Confirmado", el movimiento se incluye en el cálculo

---

## 🎯 Valores de Estados Actuales

### Tipo Movimiento (singleSelect)
- Ingreso
- Salida
- Ajuste

### Estado Entrada Insumo (singleSelect) — ⚠️ **CRÍTICO**
- **En Espera** ← Usado por warehouse
- **Confirmado** ← Usado por warehouse
- (Otros valores posibles: verificar en Airtable)

### Subtipo (singleSelect)
- Compra
- Producción
- Devolución
- Ajuste Inventario
- (Otros: verificar en Airtable)

---

## 🔑 Campos Clave para Integración OC → Inventario

### En Movimientos Insumos
| Campo | Variable .env | Valor para OC |
|-------|--------------|---------------|
| Tipo Movimiento | `AIRTABLE_MOV_TIPO_FIELD` | "Ingreso" |
| Estado Entrada Insumo | `AIRTABLE_MOV_ESTADO_FIELD` | "En Espera" → "Confirmado" |
| Documento Origen | `AIRTABLE_MOV_DOC_ORIGEN_FIELD` | ID Orden de Compra |
| ID Solicitud Compra | `AIRTABLE_MOV_ID_SOLICITUD_FIELD` | Compra Relacionada |
| ID Responsable Core | `AIRTABLE_MOV_ID_RESPONSABLE_CORE_FIELD` | Cédula almacenista |
| Area Destino Link | `AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD` | Área seleccionada |

### Mapeo OC → Movimiento
```typescript
// Items Orden de Compra (base financiera)
{
  "Descripcion del Item": "Reactivo XYZ",
  "Cantidad": 5,
  "Unidad de Medida": "kg",
  "Valor Unitario": 50000
}

// → Movimientos Insumos (base insumos)
{
  "Name": "Ingreso OC-2024-001 - Reactivo XYZ",
  "Tipo Movimiento": "Ingreso",
  "Subtipo": "Compra",
  "Estado Entrada Insumo": "En Espera",
  "Cantidad Original": 5,
  "Unidad Original": [link a "kg"],
  "Costo Unitario": 50000,
  "Documento Origen": "OC-2024-001",
  "ID Solicitud Compra": "SOLICITUD-2024-123",
  "Area Destino Link": [link a área],
  "Insumo": [link a insumo del catálogo]
}
```

---

## ⚠️ Consideraciones Importantes

### 1. Stock es Fórmula Automática
**NO se actualiza manualmente.** El flujo correcto es:
1. Crear movimiento en "En Espera"
2. Confirmar movimiento (cambiar a "Confirmado")
3. Vincular movimiento a Stock Insumos
4. La fórmula de `stock_actual` se actualiza automáticamente

### 2. Sistema de Conversión de Unidades
- Siempre guardar `Cantidad Original` + `Unidad Original`
- El sistema calcula `Cantidad Base` automáticamente
- Esto permite comprar en "kg" pero tener stock en "g"

### 3. Costos Unitarios
- Guardar `Costo Unitario` (en unidad original)
- Guardar `Costo Total` (cantidad × costo)
- El sistema calcula `Costo Unitario Base` automáticamente

### 4. Trazabilidad Completa
- `Documento Origen` = ID de Orden de Compra
- `ID Solicitud Compra` = ID de Solicitud original
- Permite rastrear: Solicitud → OC → Movimiento → Stock

---

## 📝 Campos a Mapear en .env (Ya existen)

Variables ya configuradas:
```env
# Movimientos Insumos
AIRTABLE_MOV_NOMBRE_FIELD=Name
AIRTABLE_MOV_CANTIDAD_FIELD=Cantidad
AIRTABLE_MOV_TIPO_FIELD=Tipo Movimiento
AIRTABLE_MOV_ID_RESPONSABLE_CORE_FIELD=ID Responsable Core
AIRTABLE_MOV_ID_ORIGEN_FIELD=ID Origen Movimiento
AIRTABLE_MOV_ID_ORIGEN_ITEM_FIELD=ID Origen Movimiento Item
AIRTABLE_MOV_INSUMO_FIELD=Insumo
AIRTABLE_MOV_STOCK_LINK_FIELD=Stock Insumos
AIRTABLE_MOV_CODIGO_FIELD=Código Movimiento Insumo
AIRTABLE_MOV_CREADA_FIELD=Creada

# Stock Insumos
AIRTABLE_STOCK_ID_FIELD=id_stock
AIRTABLE_STOCK_ACTUAL_FIELD=stock_actual
AIRTABLE_STOCK_ULTIMA_ACTUALIZACION_FIELD=Ultima Actualizacion
```

**⚠️ Faltan mapear:**
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

## ✅ Resumen de Blockers Actualizados

### ✅ RESUELTO — Tablas de inventario
- ✅ Todas las tablas existen en "Sirius Insumos Core"
- ✅ IDs en .env son correctos
- ✅ Variable `AIRTABLE_INS_BASE_ID` configurada

### ❌ POR IMPLEMENTAR
1. **Endpoints de OC** (B1, B2)
   - `GET /api/ordenes-compra`
   - `PATCH /api/ordenes-compra/[id]/estado`

2. **Rol Almacenista** (B3)
   - Agregar en tabla "Equipo Financiero"
   - Actualizar middleware.ts

3. **Módulo Warehouse**
   - `POST /api/warehouse/movimientos`
   - `PATCH /api/warehouse/movimientos/[id]/confirmar`
   - Frontend almacenista

4. **Variables .env faltantes**
   - Mapeo de campos adicionales de Movimientos Insumos

---

**Documento actualizado:** 2026-03-27
**Estado:** Estructura validada — Listo para implementación
