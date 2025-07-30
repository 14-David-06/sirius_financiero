# Funcionalidad de Descripción de Solicitud con Audio

## Descripción
Se ha agregado una nueva sección al formulario de solicitudes de compra llamada "Descripción de la Solicitud" que permite a los usuarios escribir directamente o grabar mensajes de voz que se transcriben automáticamente utilizando la API de OpenAI Whisper.

## Características Implementadas

### 1. Campo de Descripción Editable
- **Textarea**: Campo de texto libre para describir la solicitud
- **Escritura Manual**: Los usuarios pueden escribir directamente la descripción
- **Placeholder Informativo**: Guía al usuario sobre cómo usar el campo

### 2. Grabación de Audio Opcional
- **Botón "Grabar Descripción"**: Permite al usuario grabar usando el micrófono del dispositivo
- **Botón de Detener Grabación**: Permite finalizar la grabación
- **Indicador Visual**: El botón cambia de estado y muestra una animación pulsante durante la grabación
- **Permisos**: Solicita automáticamente permisos de micrófono al usuario

### 3. Transcripción Automática
- **Integración con OpenAI Whisper**: Utiliza el modelo whisper-1 para transcripción en español
- **Procesamiento en Tiempo Real**: La transcripción se realiza automáticamente al finalizar la grabación
- **Indicador de Progreso**: Muestra un spinner mientras se procesa la transcripción
- **Texto Combinado**: La transcripción se agrega al texto existente en el campo

### 4. Integración con Base de Datos
- **Campo en Airtable**: Se agrega un campo 'Audio Transcription' en la base de datos
- **Combinación con Descripción**: La transcripción se combina con la descripción automática de items
- **Persistencia**: La transcripción se guarda junto con los demás datos de la solicitud

## Flujo de Uso

1. **Acceso**: El usuario accede al formulario de solicitudes de compra
2. **Datos Básicos**: Completa los datos del solicitante (nombre, área, cargo)
3. **Descripción**: En la sección "Descripción de la Solicitud":
   - **Opción A - Escritura Manual**: Escribe directamente en el campo de texto
   - **Opción B - Grabación de Voz**: 
     - Hace clic en "Grabar Descripción"
     - Habla los detalles de la solicitud
     - Hace clic en "Detener Grabación"
     - El sistema transcribe automáticamente el audio
     - Puede editar el texto transcrito si es necesario
4. **Prioridad**: Selecciona la prioridad de la solicitud
5. **Items**: Agrega los items solicitados
6. **Proveedor**: Completa información del proveedor si aplica
7. **Envío**: Al enviar el formulario, la descripción se incluye en la solicitud

## Ubicación en el Formulario

La sección "Descripción de la Solicitud" se encuentra:
- **Después de**: Los datos del solicitante (nombre, área, cargo)
- **Antes de**: La prioridad de la solicitud

## Formatos de Audio Soportados

- **WebM** (formato por defecto del navegador)
- **MP4 Audio**
- **WAV**
- **OGG**

## Limitaciones

- **Tamaño máximo**: 25MB (limitación de OpenAI Whisper)
- **Idioma**: Optimizado para español
- **Conexión**: Requiere conexión a internet para la transcripción
- **Permisos**: Requiere permisos de micrófono del navegador

## Componentes Técnicos Modificados

### Frontend
- **SolicitudesCompra.tsx**: Agregadas funciones de grabación y transcripción
- **Estados añadidos**:
  - `isRecording`: Control del estado de grabación
  - `audioTranscription`: Almacena el texto transcrito
  - `mediaRecorder`: Referencia al objeto MediaRecorder
  - `audioBlob`: Almacena el archivo de audio grabado
  - `isTranscribing`: Indica si se está procesando la transcripción

### Backend
- **route.ts**: Modificado para manejar el campo `audioTranscription`
- **Airtable**: Nuevo campo 'Audio Transcription' en la tabla de solicitudes

### API Existente
- **transcribe-audio/route.ts**: Ya existía y se utiliza para procesar el audio

## Beneficios

1. **Facilidad de Uso**: Los usuarios pueden proporcionar información adicional de manera más natural
2. **Documentación Completa**: Permite capturar detalles que podrían omitirse en un formulario tradicional
3. **Eficiencia**: Reducir el tiempo de escritura para información compleja
4. **Accesibilidad**: Mejora la experiencia para usuarios que prefieren comunicación verbal

## Uso Recomendado

La descripción de la solicitud es ideal para:
- **Explicación General**: Propósito y contexto de la solicitud de compra
- **Justificaciones**: Razones por las cuales se necesitan los items
- **Detalles Técnicos**: Especificaciones o requerimientos especiales
- **Urgencias**: Explicación de por qué es urgente o tiene prioridad
- **Contexto del Proyecto**: A qué proyecto o actividad corresponde la compra
- **Consideraciones Especiales**: Cualquier información relevante adicional

La funcionalidad de audio facilita especialmente:
- Descripciones largas o complejas
- Cuando el usuario prefiere dictar en lugar de escribir
- Captura rápida de ideas sin preocuparse por la escritura
- Información técnica que es más fácil de explicar verbalmente
