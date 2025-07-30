# Integración AWS S3 para Cotizaciones de Proveedores

## Descripción
Se ha implementado la integración con AWS S3 para almacenar automáticamente los archivos de cotización de proveedores en el bucket `siriusadministrativo` con un formato de nomenclatura específico.

## Configuración AWS

### Credenciales (Variables de Entorno)
- **Account ID**: Se obtiene de variable de entorno `AWS_ACCOUNT_ID`
- **Username**: automatizaciones (usuario IAM para la aplicación)
- **Access Key**: Se obtiene de variable de entorno `AWS_ACCESS_KEY_ID`
- **Secret Key**: Se obtiene de variable de entorno `AWS_SECRET_ACCESS_KEY`
- **Bucket**: Se obtiene de variable de entorno `AWS_S3_BUCKET`
- **Region**: Se obtiene de variable de entorno `AWS_REGION`

### Variables de Entorno Requeridas
```bash
AWS_ACCESS_KEY_ID=tu_access_key_aqui
AWS_SECRET_ACCESS_KEY=tu_secret_key_aqui
AWS_REGION=us-east-1
AWS_S3_BUCKET=siriusadministrativo
AWS_ACCOUNT_ID=tu_account_id_aqui
```

> ⚠️ **IMPORTANTE**: Estas credenciales NUNCA deben estar hardcodeadas en el código fuente. Deben configurarse como variables de entorno en el servidor de producción. 

## Funcionalidad Implementada

### 1. Nomenclatura de Archivos
Los archivos se nombran automáticamente siguiendo el formato:
```
siriusadministrativo[Nombre del proveedor][Nombre de la persona que hace la solicitud][Fecha actual].extension
```

**Ejemplo**:
```
siriusadministrativo[Suramericana][David Hernandez][2025-01-30].pdf
```

### 2. Proceso de Carga

#### Frontend (SolicitudesCompra.tsx)
1. **Selección de Archivo**: Usuario selecciona archivo PDF/imagen
2. **Datos Automáticos**: Se extraen automáticamente:
   - Nombre del proveedor (del campo de formulario)
   - Nombre del solicitante (usuario seleccionado)
   - Fecha actual (timestamp del sistema)
3. **Upload a S3**: Se envía al endpoint `/api/upload-file`
4. **URL de Retorno**: Se recibe la URL pública del archivo

#### Backend (upload-file/route.ts)
1. **Validación**: Verifica credenciales AWS y datos requeridos
2. **Generación de Nombre**: Crea el nombre según el formato especificado
3. **Upload S3**: Sube el archivo usando AWS SDK
4. **Metadata**: Incluye información adicional en metadatos del archivo
5. **URL Pública**: Retorna la URL accesible del archivo

### 3. Integración con Airtable

#### Campo en Base de Datos
- **Campo**: "Cotizacion Doc"
- **Tipo**: Text/URL
- **Contenido**: URL completa del archivo en S3

#### Formato de URL
```
https://[BUCKET_NAME].s3.[REGION].amazonaws.com/siriusadministrativo[Proveedor][Solicitante][Fecha].extension
```

## Flujo Completo

### 1. Usuario Completa Formulario
- Selecciona su nombre
- Agrega items de compra
- Indica que tiene proveedor
- Ingresa nombre del proveedor

### 2. Carga de Cotización
- Selecciona archivo PDF/imagen
- Sistema automáticamente:
  - Extrae nombre del proveedor del formulario
  - Usa nombre del solicitante seleccionado
  - Genera nombre con fecha actual
  - Sube archivo a S3
  - Obtiene URL pública

### 3. Envío de Solicitud
- La URL del archivo se incluye en el campo "Cotizacion Doc"
- Se guarda junto con todos los demás datos en Airtable
- La cotización queda permanentemente almacenada y accesible

## Características Técnicas

### Validaciones
- **Tipos de Archivo**: PDF, JPG, PNG, WebP
- **Tamaño Máximo**: 10MB
- **Datos Requeridos**: Proveedor y solicitante

### Metadatos en S3
Cada archivo incluye metadatos:
```json
{
  "original-name": "cotizacion.pdf",
  "proveedor": "Suramericana",
  "solicitante": "David Hernandez",
  "fecha-upload": "2025-01-30T15:30:00.000Z"
}
```

### Error Handling
- Credenciales AWS faltantes
- Archivos no válidos
- Errores de conexión S3
- Datos de proveedor/solicitante faltantes

## Seguridad y Mejores Prácticas

### 🔒 Gestión de Credenciales
1. **Variables de Entorno**: Todas las credenciales se almacenan exclusivamente en variables de entorno
2. **Archivo .env.local**: NO debe subirse al repositorio (incluido en .gitignore)
3. **Plantilla .env.example**: Archivo de ejemplo sin credenciales reales
4. **Rotación de Claves**: Se recomienda rotar las credenciales AWS periódicamente

### 🛡️ Configuración de Producción
- Usar AWS IAM roles en lugar de access keys cuando sea posible
- Implementar políticas de menor privilegio en AWS
- Habilitar logging y monitoreo de acceso a S3
- Usar HTTPS para todas las comunicaciones

### 📋 Checklist de Seguridad
- [ ] Credenciales almacenadas como variables de entorno
- [ ] Archivo .env.local en .gitignore
- [ ] Sin credenciales hardcodeadas en código fuente
- [ ] Políticas IAM restrictivas configuradas
- [ ] Monitoreo de acceso S3 habilitado

## Beneficios

1. **Almacenamiento Centralizado**: Todos los archivos en un bucket organizado
2. **Nomenclatura Consistente**: Fácil identificación y búsqueda de archivos
3. **Acceso Directo**: URLs públicas para acceso inmediato
4. **Metadatos Completos**: Información detallada de cada archivo
5. **Escalabilidad**: Preparado para manejar grandes volúmenes
6. **Seguridad**: Archivos almacenados en infraestructura AWS

## URLs de Ejemplo

```
https://[tu-bucket].s3.[region].amazonaws.com/siriusadministrativo[Suramericana][David Hernandez][2025-01-30].pdf
https://[tu-bucket].s3.[region].amazonaws.com/siriusadministrativo[Construtek][Luisa Ramirez][2025-01-30].jpg
https://[tu-bucket].s3.[region].amazonaws.com/siriusadministrativo[OfficeDepot][Santiago Amaya][2025-01-30].png
```

> **Nota**: Reemplaza `[tu-bucket]` y `[region]` con los valores reales configurados en tus variables de entorno.

La integración está completamente funcional y automatizada, requiriendo solo que el usuario seleccione el archivo de cotización en el formulario.
