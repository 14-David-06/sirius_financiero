# Actualización: Carga Directa de PDFs en ScannerComprobante

## Fecha de Implementación
2026-05-28

## Descripción
Se ha actualizado el componente `ScannerComprobante` para permitir dos modos de carga de comprobantes:
1. **Escanear Imágenes**: Modo original que permite capturar/subir imágenes y convertirlas a PDF con mejoras de contraste
2. **Cargar PDF**: Nuevo modo que permite cargar archivos PDF directamente sin necesidad de escanear

## Cambios Implementados

### 1. Selector de Modo de Carga
Se agregó un selector de dos botones que permite al usuario elegir el modo de carga:
- **Escanear Imágenes**: Activa el flujo de captura/subida de imágenes + procesamiento + generación de PDF
- **Cargar PDF**: Activa el flujo de selección directa de archivos PDF

### 2. Nuevo Estado y Lógica
```typescript
type UploadMode = 'scanner' | 'pdf';
const [uploadMode, setUploadMode] = useState<UploadMode>('scanner');
const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
const pdfInputRef = useRef<HTMLInputElement>(null);
```

### 3. Función de Carga de PDF
```typescript
const handlePdfUpload = useCallback(async (files: FileList | null) => {
  if (!files || files.length === 0) return;
  const file = files[0];
  if (file.type !== 'application/pdf') {
    setError('Solo se aceptan archivos PDF');
    return;
  }
  setUploadedPdfFile(file);
  const previewUrl = URL.createObjectURL(file);
  setPdfPreviewUrl(previewUrl);
  setPdfReady(true);
  onPdfReady(file, file.name);
}, [onPdfReady]);
```

### 4. Input HTML Oculto para PDF
```typescript
<input
  ref={pdfInputRef}
  type="file"
  accept="application/pdf"
  className="hidden"
  onChange={e => handlePdfUpload(e.target.files)}
/>
```

### 5. UI Condicional Según Modo
- **Modo Scanner**: Muestra botones de cámara y subir imagen, galería de imágenes escaneadas
- **Modo PDF**: Muestra botón de selección de PDF, vista previa del archivo cargado

## Flujos de Usuario

### Flujo 1: Escanear Imágenes (Modo Original)
1. Usuario selecciona "Escanear Imágenes" (por defecto)
2. Captura fotos con cámara o sube imágenes desde galería
3. Imágenes se procesan automáticamente (mejora de contraste)
4. Se genera PDF automáticamente de las imágenes procesadas
5. PDF listo para guardar en el registro

### Flujo 2: Cargar PDF Directamente (Nuevo)
1. Usuario selecciona "Cargar PDF"
2. Click en "Seleccionar archivo PDF"
3. Selecciona archivo PDF desde su dispositivo
4. Vista previa del PDF se muestra
5. PDF listo para guardar en el registro

## Validaciones
- **Modo Scanner**: Solo acepta archivos de imagen (JPG, PNG, WEBP, HEIC)
- **Modo PDF**: Solo acepta archivos PDF (application/pdf)
- Límite de 5 imágenes en modo scanner
- Límite de 1 archivo PDF en modo PDF

## Beneficios
1. **Flexibilidad**: Usuario puede elegir el método más conveniente según su caso de uso
2. **Eficiencia**: Si ya tiene un PDF, no necesita escanear imágenes
3. **Compatibilidad**: Acepta PDFs de cualquier fuente (escáneres externos, apps móviles, etc.)
4. **Experiencia de Usuario**: Interfaz clara con selector de modo visible

## Componentes Afectados
- `src/components/ScannerComprobante.tsx` (actualizado)
- `src/components/CajaMenor.tsx` (label actualizado)

## Uso en Formulario de Caja Menor
El label del campo fue actualizado de:
```tsx
"Escanear Comprobante (Opcional)"
```
A:
```tsx
"Comprobante (Opcional)"
"Puede escanear imágenes o cargar un archivo PDF directamente"
```

## Retrocompatibilidad
✅ **Totalmente retrocompatible**: El modo por defecto es "scanner", manteniendo el comportamiento original para usuarios que ya conocen el flujo.

## Testing Recomendado
- [ ] Probar modo scanner con cámara
- [ ] Probar modo scanner con imágenes de galería
- [ ] Probar modo scanner con múltiples imágenes
- [ ] Probar modo PDF con archivo válido
- [ ] Probar modo PDF con archivo inválido (no PDF)
- [ ] Verificar que la vista previa funciona en ambos modos
- [ ] Verificar que el botón de limpiar funciona en ambos modos
- [ ] Verificar que el PDF se guarda correctamente en Airtable/S3

## Próximas Mejoras Posibles
- Permitir cargar múltiples PDFs y combinarlos
- Agregar opción de rotar páginas del PDF
- Permitir extraer páginas específicas de un PDF grande
- Comprimir PDFs grandes antes de subir
