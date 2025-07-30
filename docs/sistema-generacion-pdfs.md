# Sistema de Generación de PDFs para Solicitudes de Compra

## Descripción
Se ha implementado un sistema completo de generación automática de PDFs para las solicitudes de compra, con almacenamiento organizado en AWS S3 en carpetas separadas para cotizaciones y solicitudes.

## Organización del Bucket S3

### Estructura de Carpetas
```
siriusadministrativo/
├── cotizaciones/
│   ├── siriusadministrativo[Proveedor][Solicitante][YYYY-MM-DD].pdf
│   ├── siriusadministrativo[Proveedor][Solicitante][YYYY-MM-DD].jpg
│   └── ...
└── solicitudes/
    ├── solicitudcompra[NombreSolicitante][YYYY-MM-DD].pdf
    ├── solicitudcompra[NombreSolicitante][YYYY-MM-DD].pdf
    └── ...
```

### Ejemplos de Nomenclatura

#### Cotizaciones (carpeta: `cotizaciones/`)
```
siriusadministrativo[Suramericana][David Hernandez][2025-07-30].pdf
siriusadministrativo[Construtek][Luisa Ramirez][2025-07-30].jpg
siriusadministrativo[OfficeDepot][Santiago Amaya][2025-07-30].png
```

#### Solicitudes (carpeta: `solicitudes/`)
```
solicitudcompraPabloAcebedo2025-07-16.pdf
solicitudcompraDavidHernandez2025-07-30.pdf
solicitudcompraLuisaRamirez2025-07-30.pdf
```

## Características del PDF Generado

### Diseño Profesional
- **Formato**: A4 con márgenes estándar
- **Encabezado**: Logo y título de Sirius Financiero
- **Colores**: Esquema corporativo azul y gris
- **Tipografía**: Arial para máxima legibilidad

### Contenido Incluido

#### 1. Información del Solicitante
- Nombre completo
- Área de trabajo
- Cargo
- Prioridad de la solicitud

#### 2. Descripción de la Solicitud
- Transcripción de audio (si existe)
- Descripción detallada
- Formato de texto enriquecido

#### 3. Tabla de Ítems
- Lista completa de items solicitados
- Cantidad y valores unitarios
- Valores totales por item
- Centro de costos
- Prioridad individual

#### 4. Información del Proveedor (si aplica)
- Razón social del proveedor
- Enlace a cotización adjunta
- Metadatos del archivo

#### 5. Resumen Financiero
- Valor total de la solicitud
- Número de items
- Información de generación

### Metadatos en S3

#### Para Solicitudes PDF
```json
{
  "tipo-documento": "solicitud-compra",
  "solicitante": "Pablo Acebedo",
  "area": "RAAS",
  "fecha-generacion": "2025-07-30T15:30:00.000Z",
  "numero-items": "3"
}
```

#### Para Cotizaciones
```json
{
  "original-name": "cotizacion.pdf",
  "proveedor": "Suramericana",
  "solicitante": "David Hernandez",
  "fecha-upload": "2025-07-30T15:30:00.000Z",
  "tipo-documento": "cotizacion"
}
```

## Flujo Automático

### 1. Creación de Solicitud
1. Usuario completa formulario
2. Sistema procesa datos y crea registros en Airtable
3. **Automáticamente** se genera PDF con todos los datos
4. PDF se sube a S3 en carpeta `solicitudes/`
5. URL del PDF se retorna al usuario

### 2. Carga de Cotización
1. Usuario selecciona archivo de cotización
2. Archivo se sube a S3 en carpeta `cotizaciones/`
3. URL se guarda en base de datos
4. URL se incluye en el PDF de la solicitud

## APIs Implementadas

### `/api/generate-pdf` (POST)
**Función**: Genera PDF de solicitud de compra

**Input**:
```json
{
  "solicitudData": {
    "nombreSolicitante": "Pablo Acebedo",
    "areaSolicitante": "RAAS",
    "cargoSolicitante": "CTO",
    "prioridadSolicitud": "Alta",
    "descripcionIAInterpretacion": "Descripción...",
    "items": [...],
    "razonSocialProveedor": "Suramericana",
    "cotizacionDoc": "https://..."
  }
}
```

**Output**:
```json
{
  "success": true,
  "pdfUrl": "https://siriusadministrativo.s3.us-east-1.amazonaws.com/solicitudes/solicitudcompraPabloAcebedo2025-07-16.pdf",
  "fileName": "solicitudcompraPabloAcebedo2025-07-16.pdf",
  "fullPath": "solicitudes/solicitudcompraPabloAcebedo2025-07-16.pdf",
  "metadata": {...}
}
```

### `/api/upload-file` (POST)
**Función**: Sube archivo de cotización

**Output**: URL en carpeta `cotizaciones/`

### `/api/solicitudes-compra` (POST)
**Función**: Crea solicitud y genera PDF automáticamente

**Output**: Incluye URL del PDF generado

## Características Técnicas

### Generación de PDF
- **Motor**: Puppeteer (renderizado Chrome headless)
- **Resolución**: Alta calidad para impresión
- **Tamaño**: Optimizado automáticamente
- **Tiempo**: ~3-5 segundos por PDF

### Almacenamiento
- **Bucket**: siriusadministrativo
- **Región**: us-east-1
- **Acceso**: URLs públicas directas
- **Durabilidad**: 99.999999999% (11 9's)

### Integración Frontend
- **Notificación**: Modal de éxito con enlace de descarga
- **Acceso Inmediato**: Link directo al PDF generado
- **Fallback**: Solicitud se crea aunque falle la generación del PDF

## URLs de Ejemplo

### Solicitudes
```
https://siriusadministrativo.s3.us-east-1.amazonaws.com/solicitudes/solicitudcompraPabloAcebedo2025-07-16.pdf
https://siriusadministrativo.s3.us-east-1.amazonaws.com/solicitudes/solicitudcompraDavidHernandez2025-07-30.pdf
```

### Cotizaciones
```
https://siriusadministrativo.s3.us-east-1.amazonaws.com/cotizaciones/siriusadministrativo[Suramericana][Pablo Acebedo][2025-07-30].pdf
```

## Beneficios

1. **Automatización Completa**: PDF se genera sin intervención manual
2. **Organización Perfecta**: Carpetas separadas por tipo de documento
3. **Nomenclatura Consistente**: Fácil búsqueda y clasificación
4. **Acceso Inmediato**: URLs directas sin autenticación
5. **Profesionalismo**: PDFs con diseño corporativo
6. **Respaldo Permanente**: Documentos almacenados indefinidamente
7. **Escalabilidad**: Preparado para grandes volúmenes
8. **Trazabilidad**: Metadatos completos para auditoría

El sistema está completamente operativo y genera automáticamente PDFs profesionales para cada solicitud de compra creada.
