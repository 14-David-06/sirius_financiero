# Integración de Indicadores de Producción

## Descripción

El módulo de **Indicadores de Producción** integra datos de dos bases de Airtable diferentes para proporcionar métricas consolidadas de rendimiento productivo:

1. **Base de Flujo de Caja**: Tabla "Movimientos_Bancarios_Bancolombia (Capital de Trabajo)"
2. **Base de Pirólisis**: Tabla "Balances Masa"

## Arquitectura

### Endpoints de API

#### 1. `/api/movimientos-bancarios`
Obtiene los movimientos bancarios de la tabla principal de Flujo de Caja.

**Parámetros:**
- `maxRecords` (opcional): Número máximo de registros a retornar
- `filterByFormula` (opcional): Fórmula de filtrado de Airtable

**Respuesta:**
```json
{
  "records": [...],
  "success": true
}
```

#### 2. `/api/balances-masa`
Obtiene los balances de masa de producción de la base de Pirólisis.

**Parámetros:**
- `maxRecords` (opcional): Número máximo de registros a retornar
- `filterByFormula` (opcional): Fórmula de filtrado de Airtable

**Respuesta:**
```json
{
  "records": [...],
  "success": true
}
```

#### 3. `/api/indicadores-produccion`
Endpoint principal que consolida datos de ambas bases y calcula indicadores de producción.

**Parámetros:**
- `periodo` (opcional): Periodo en formato YYYY-MM (ej: "2025-10")
- `unidadNegocio` (opcional): Filtrar por unidad de negocio específica

**Respuesta:**
```json
{
  "indicadores": [
    {
      "id": "string",
      "unidadNegocio": "string",
      "periodo": "string",
      "unidadesProducidas": number,
      "unidadesObjetivo": number,
      "horasProduccion": number,
      "horasDisponibles": number,
      "defectos": number,
      "costoProduccion": number,
      "eficiencia": number,
      "productividad": number,
      "calidadPorcentaje": number,
      "utilizacionCapacidad": number,
      "estado": "Excelente" | "Bueno" | "Regular" | "Crítico",
      "empleadosAsignados": number,
      "costoUnitario": number
    }
  ],
  "success": true
}
```

## Cálculo de Indicadores

### Unidad de Pirólisis
Para la unidad de Pirólisis, se utilizan datos reales de la tabla "Balances Masa":

- **Unidades Producidas**: Suma de "Peso Biochar (KG)" de todos los registros
- **Eficiencia**: Calculada en base a temperaturas del reactor (R1, R2, R3)
  - Temperatura óptima: 350-450°C → 95% eficiencia
  - Temperatura aceptable: 300-350°C o 450-500°C → 85% eficiencia
  - Fuera de rango → 70% eficiencia
- **Calidad**: Basada en la consistencia de temperaturas (desviación estándar)
  - Desviación < 50°C → 99% calidad
  - Desviación < 100°C → 95% calidad
  - Mayor desviación → 90% calidad

### Otras Unidades de Negocio
Para Biológicos, RaaS y Administración:

- **Unidades Producidas**: Estimadas en base a ingresos (Ingresos / 50,000)
- **Eficiencia**: Basada en relación ingresos vs costos
  - Ingresos > Costos → 90% eficiencia
  - Caso contrario → 75% eficiencia
- **Calidad**: Valor fijo de 97%

### Costos de Producción
Extraídos de la tabla "Movimientos_Bancarios_Bancolombia":
- Suma de todos los valores negativos donde `Clasificacion` incluye "Costo" o "Gasto"
- Filtrados por `Unidad de Negocio` correspondiente

### Ingresos
Extraídos de la tabla "Movimientos_Bancarios_Bancolombia":
- Suma de todos los valores positivos o donde `Clasificacion` incluye "Ingreso"
- Filtrados por `Unidad de Negocio` correspondiente

## Variables de Entorno Requeridas

```env
# Base de Flujo de Caja
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...

# Base de Pirólisis
PIROLISIS_AIRTABLE_API_KEY=patzfAySCZmA9Xnbo...
PIROLISIS_AIRTABLE_BASE_ID=appBNCVj4Njbyu1En
PIROLISIS_BALANCES_MASA_TABLE_ID=tbljPXKCZ9FKTgsTB
```

## Campos Utilizados

### De Movimientos_Bancarios_Bancolombia
- `Fecha`: Fecha del movimiento
- `Valor`: Monto del movimiento (positivo = ingreso, negativo = egreso)
- `Clasificacion`: Tipo de movimiento (Costo, Gasto, Ingreso, etc.)
- `Unidad de Negocio`: Unidad de negocio asociada
- `Unidad de Negocio 1`: Campo alternativo de unidad de negocio
- `Año formulado`: Año del movimiento
- `Numero Mes formulado`: Número del mes

### De Balances Masa
- `Fecha`: Fecha del balance
- `Peso Biochar (KG)`: Cantidad de biochar producido
- `Temperatura Reactor (R1)`: Temperatura del reactor 1
- `Temperatura Reactor (R2)`: Temperatura del reactor 2
- `Temperatura Reactor (R3)`: Temperatura del reactor 3
- `Temperatura Horno (H1-H4)`: Temperaturas del horno
- `Semana Formulada`: Número de semana

## Componente Frontend

El componente `IndicadoresProduccion.tsx` muestra:

1. **Métricas Consolidadas**:
   - Total de unidades producidas
   - Eficiencia promedio
   - Calidad promedio
   - Utilización de capacidad

2. **Tabla de Indicadores por Unidad**:
   - Producción vs objetivo
   - Eficiencia
   - Calidad
   - Costo unitario
   - Estado general

3. **Filtros**:
   - Búsqueda por nombre de planta o periodo
   - Selector de periodo (mes/año)
   - Filtro por estado (Excelente, Bueno, Regular, Crítico)

4. **Modal de Detalles**:
   - Información completa de cada indicador
   - Métricas detalladas por planta

## Funcionalidades

- ✅ Carga automática de datos reales desde Airtable
- ✅ Filtrado por periodo (año/mes)
- ✅ Filtrado por estado y búsqueda de texto
- ✅ Exportación de datos a CSV
- ✅ Visualización de detalles por unidad
- ✅ Cálculo automático de indicadores
- ✅ Indicadores visuales de rendimiento
- ✅ Responsive design

## Notas Importantes

1. **Fallback**: Si falla la carga de datos reales, el componente muestra datos de ejemplo
2. **Cache**: Los datos se recargan cada vez que cambia el periodo seleccionado
3. **Seguridad**: Requiere autenticación para acceder a los indicadores
4. **Performance**: Se limita a 5000 registros por tabla para optimizar rendimiento

## Ejemplo de Uso

```typescript
// En el componente
const [periodoSeleccionado, setPeriodoSeleccionado] = useState('2025-10');

// Los datos se cargan automáticamente cuando cambia el periodo
useEffect(() => {
  const fetchIndicadores = async () => {
    const response = await fetch(`/api/indicadores-produccion?periodo=${periodoSeleccionado}`);
    const data = await response.json();
    setIndicadores(data.indicadores);
  };
  
  fetchIndicadores();
}, [periodoSeleccionado]);
```

## Mantenimiento

Para agregar nuevas métricas o modificar cálculos, editar la función `procesarIndicadores` en `/api/indicadores-produccion/route.ts`.

## Troubleshooting

### Error: "Cannot read properties of undefined"
- Verificar que las variables de entorno estén correctamente configuradas
- Verificar que las API keys de Airtable sean válidas

### No se muestran datos
- Verificar que existan registros en las tablas de Airtable para el periodo seleccionado
- Revisar los filtros aplicados en la interfaz

### Datos incorrectos
- Verificar los nombres de campos en Airtable coincidan con los utilizados en el código
- Revisar la lógica de cálculo en `procesarIndicadores`
