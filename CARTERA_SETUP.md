# 📊 Módulo de Cartera - Configuración Completa

## 🎯 Resumen

Módulo de monitoreo y gestión de cartera (cuentas por cobrar) integrado con la tabla **PagoFacturas** existente en Airtable. Proporciona análisis de estados de facturación, KPIs financieros, y seguimiento de cobros.

---

## ✅ Tabla en Airtable (Ya Existe)

### Nombre de la Tabla
**`PagoFacturas`** (ID: `tbloCva8TDQNdv0Gn`)

### Estructura de Campos (Actual)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **ID** | Formula | `RECORD_ID()` - Identificador único |
| **id_factura** | Link to another record | → Facturacion Ingresos |
| **Nombre del Comprador (from id_factura)** | Lookup | Nombre del cliente |
| **NIT Comprador (from id_factura)** | Lookup | NIT del cliente |
| **Factura No** | Lookup | Número de factura |
| **Total_recibir** | Lookup | Monto total de la factura |
| **Saldo Anterior** | Currency | Saldo previo |
| **Monto_restante** | Currency | **Saldo pendiente actual** |
| **Estado_Factura** | Single Select | Estado: `Pagada`, `Sin Pagar`, `Parcial`, `Pendiente` |
| **Movimientos_Bancarios (from id_factura)** | Lookup | Links a movimientos |
| **Total Movimientos** | Lookup | Total de pagos realizados |
| **Fecha Creacion** | Created time | Timestamp de creación |
| **Ultima Modificación** | Last modified time | Última edición |

### Estados de Factura

| Estado | Color | Significado |
|--------|-------|-------------|
| **Pagada** | Verde | Factura totalmente pagada |
| **Sin Pagar** | Rojo | Sin pagos registrados |
| **Parcial** | Amarillo | Pagos parciales |
| **Pendiente** | Azul | En proceso de cobro |

---

## 📦 Archivos Creados

### ✅ Componentes
- `src/components/MonitoreoCartera.tsx` - Componente principal

### ✅ Tipos TypeScript
- `src/types/cartera.ts` - Interfaces adaptadas a PagoFacturas

### ✅ Páginas
- `src/app/monitoreo-cartera/page.tsx` - Página con RoleGuard

### ✅ APIs
- `src/app/api/cartera/route.ts` - GET principal (usa PagoFacturas)
- `src/app/api/cartera/estadisticas/route.ts` - KPIs calculados
- `src/app/api/cartera/aging/route.ts` - Distribución por estado
- `src/app/api/cartera/[id]/route.ts` - CRUD individual

### ✅ Navbar
- `src/components/layout/Navbar.tsx` - Agregada opción "Cartera - Cuentas por Cobrar" en menú Finanzas (desktop y móvil)

---

## 🚀 Puesta en Marcha

### 1. No se requiere configuración adicional
La tabla **PagoFacturas** ya existe y está siendo usada por el sistema.

### 2. Verificar servidor
```bash
npm run dev
```

### 3. Acceder al módulo
```
http://localhost:3000/monitoreo-cartera
```

### 4. Ubicación en el menú
**Navbar → Finanzas → Cartera - Cuentas por Cobrar**

---

## 📊 Funcionalidades Implementadas

### Dashboard Principal

#### KPIs Cards (4 tarjetas)
1. **Saldo Pendiente Total** 
   - Suma de `Monto_restante` (excluyendo "Pagada")
   - Icono: DollarSign (azul)

2. **Total Facturado**
   - Suma de `Total_recibir` de todas las facturas
   - Icono: FileText (púrpura)

3. **Total Recaudado**
   - Suma de `Total Movimientos` (pagos realizados)
   - Badge: % de recaudación
   - Icono: CheckCircle2 (verde)

4. **Sin Pagar**
   - Suma de `Monto_restante` con estado "Sin Pagar"
   - Icono: AlertTriangle (rojo)

### Gráficos Interactivos

1. **Distribución por Estado** (BarChart)
   - Eje X: Estados (Sin Pagar, Parcial, Pendiente, Pagada)
   - Eje Y: Monto en COP
   - Colores por estado

2. **Composición de Cartera** (PieChart)
   - Distribución porcentual por estado
   - Labels con porcentajes

3. **Top 10 Clientes** (BarChart horizontal)
   - Clientes con mayor saldo pendiente
   - Ordenado descendente

### Tabla Interactiva

#### Columnas
- Cliente (nombre + NIT)
- Factura No.
- Total Factura
- Saldo Pendiente
- Pagado
- Estado (badge coloreado)
- Acciones (ver detalle)

#### Funcionalidades
- ✅ Búsqueda por cliente, factura, NIT
- ✅ Filtro por estado
- ✅ Ordenamiento por columnas (click en headers)
- ✅ Conteo de registros filtrados
- ✅ Estados de carga y vacío

### Modal de Detalle

Al hacer clic en el ícono de ojo se abre modal con:
- Información completa de la factura
- Datos del cliente
- Montos: Total, Pagado, Pendiente
- Estado visual con badge
- Fechas de creación

---

## 🔐 Control de Acceso

### Roles Autorizados
- **Colaborador**: Solo lectura
- **Administrador**: Lectura + Edición
- **Gerencia**: Lectura + Edición
- **Desarrollador**: Acceso completo

### Configurado en
- `src/app/monitoreo-cartera/page.tsx` con RoleGuard
- `src/components/layout/Navbar.tsx` (solo visible para no-Colaboradores)

---

## 🎨 Diseño Glass-Morphism

Siguiendo el patrón del proyecto:
- **Fondo**: Gradiente `from-blue-50 via-purple-50 to-pink-50`
- **Cards**: `bg-white/80 backdrop-blur-sm`
- **Bordes**: `border border-gray-200`
- **Hovers**: `hover:shadow-md transition-all`
- **Badges**: Colores sólidos según estado
- **Iconos**: Lucide React con gradientes

---

## 📈 KPIs Calculados

### Saldo Total
```typescript
Suma de Monto_restante donde Estado_Factura ≠ 'Pagada'
```

### Total Facturado
```typescript
Suma de Total_recibir (todas las facturas)
```

### Total Recaudado
```typescript
Suma de Total Movimientos (todos los pagos)
```

### % Recaudado
```typescript
(Total Recaudado / Total Facturado) × 100
```

### Cartera Sin Pagar
```typescript
Suma de Monto_restante donde Estado_Factura = 'Sin Pagar'
```

### Cartera Parcial
```typescript
Suma de Monto_restante donde Estado_Factura = 'Parcial'
```

### Cartera Pendiente
```typescript
Suma de Monto_restante donde Estado_Factura = 'Pendiente'
```

---

## 🔄 Integración con Sistema Existente

### Relación con otras tablas

```
Facturacion Ingresos
       ↓ (Link)
  PagoFacturas ← Este módulo lee aquí
       ↓ (Lookup)
Movimientos_Bancarios
```

### Flujo de datos
1. **Factura creada** → Registro en `Facturacion Ingresos`
2. **Sistema crea registro** → En `PagoFacturas` (automático)
3. **Pagos registrados** → Enlazados vía `Movimientos_Bancarios`
4. **Estado actualizado** → Según saldo pendiente
5. **Dashboard actualiza** → En tiempo real al refrescar

---

## 🐛 Troubleshooting

### Error: "No hay registros para mostrar"
- Verificar que la tabla `PagoFacturas` tiene datos
- Verificar filtros aplicados
- Revisar console del navegador para errores de API

### KPIs muestran 0
- Verificar estructura de lookups en Airtable
- Verificar que los campos `Total_recibir` y `Total Movimientos` tienen valores
- Revisar logs del servidor: `npm run dev`

### Gráficos no renderizan
- Verificar que Recharts está instalado: `npm install recharts`
- Limpiar caché: `npm run dev` con `--clean`
- Verificar console del navegador

### "Cannot read properties of undefined"
- Verificar nombres exactos de campos en Airtable
- Los lookups deben estar configurados correctamente
- Revisar tipos en `src/types/cartera.ts`

---

## 🎯 Próximas Mejoras (Opcionales)

### Funcionalidades Adicionales
1. **Registrar Pagos Manualmente**
   - Modal para ingresar pagos
   - Actualización de saldo automático

2. **Enviar Recordatorios**
   - Templates de email
   - Historial de comunicaciones

3. **Informes Exportables**
   - PDF: Estado de cartera
   - Excel: Listado completo
   - Filtros aplicados al exportar

4. **Análisis Avanzado**
   - Días promedio de cobro (DSO)
   - Proyección de cobros futuros
   - Alertas de vencimientos

5. **Integración con Movimientos**
   - Ver detalle de pagos realizados
   - Timeline de transacciones
   - Conciliación bancaria

---

## 📞 Información Técnica

### ID de Tabla
```env
AIRTABLE_CARTERA_TABLE_ID=tbloCva8TDQNdv0Gn
```
*Nota: Hardcodeado en APIs, no requiere variable de entorno*

### Endpoints API
```
GET  /api/cartera              - Listar registros (con filtros)
GET  /api/cartera/estadisticas - KPIs calculados
GET  /api/cartera/aging        - Distribución por estado
GET  /api/cartera/[id]         - Registro individual
```

### Formato de Response
```typescript
{
  success: boolean,
  data: CarteraRecord[] | CarteraKPIs | EstadoCarteraData[],
  error?: string
}
```

---

**Creado**: 2026-09-05  
**Versión**: 2.0 (Adaptado a estructura real)  
**Autor**: Claude Code + David (Sirius Regenerative)  
**Base**: Tabla PagoFacturas existente en Airtable
