# Configuración de n8n para Facturación de Ingresos

## Flujo de Procesamiento

```
Usuario sube PDF → OneDrive → Webhook n8n → Procesamiento → Callback API
```

## Payload que n8n Recibe

Cuando se activa el webhook, n8n recibe este payload:

```json
{
  "transactionId": "txn_1704672000000_abc123xyz",
  "fileName": "factura.pdf",
  "fileSize": 524288,
  "fileId": "ONEDRIVE_FILE_ID",
  "webUrl": "https://onedrive-url/...",
  "timestamp": "2026-01-07T12:00:00.000Z",
  "type": "factura_ingreso",
  "callbackUrl": "https://your-domain.com/api/facturacion-callback"
}
```

## Configuración del Workflow de n8n

### 1. Webhook Trigger
- **URL**: Configurar en n8n (webhook URL será generada al crear el nodo)
- **Método**: POST
- **Authentication**: Opcional (Bearer Token recomendado)

### 2. Nodos Recomendados

#### Nodo 1: Webhook (Trigger)
Recibe el payload con la información del archivo

#### Nodo 2: Descargar PDF de OneDrive (HTTP Request)
```javascript
// URL del archivo desde el payload
{{ $json.webUrl }}
```

#### Nodo 3: Procesar PDF (Code/Python)
Opciones:
- **Opción A**: Usar Azure Form Recognizer / Document Intelligence
- **Opción B**: Usar OCR + AI (OpenAI GPT-4 Vision)
- **Opción C**: PDF parsing libraries (PyPDF2, pdfplumber)

Ejemplo con OpenAI:
```javascript
{
  "model": "gpt-4-vision-preview",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Extrae la siguiente información de esta factura: Número de factura, Fecha de emisión, Nombre del comprador, Total bruto, IVA, Descuento, Total a cobrar, CUFE, Retenciones (RETEICA, RETEIVA, RETEFUENTE)"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:application/pdf;base64,..."
          }
        }
      ]
    }
  ]
}
```

#### Nodo 4: Estructurar Datos
Transformar la respuesta del AI en formato estructurado:

```json
{
  "facturaNo": "13002",
  "fechaEmision": "2026-01-15",
  "nombreComprador": "CLIENTE XYZ",
  "totalBruto": "5000000",
  "descuento": "0",
  "iva": "950000",
  "totalPorCobrar": "5950000",
  "reteica": "50000",
  "reteiva": "28500",
  "retefuente": "150000",
  "cufe": "abc123...",
  "cuenta": "Ingreso de Actividades Ordinarias",
  "grupo": "Ingreso",
  "clase": "Operacional"
}
```

#### Nodo 5: HTTP Request - Callback
**Configuración CRÍTICA**: Este nodo envía los resultados de vuelta a tu aplicación

```
Method: POST
URL: {{ $('Webhook').item.json.callbackUrl }}
Authentication: None
Headers:
  Content-Type: application/json

Body (JSON):
{
  "transactionId": "{{ $('Webhook').item.json.transactionId }}",
  "success": true,
  "data": {
    "facturaNo": "{{ $json.facturaNo }}",
    "fechaEmision": "{{ $json.fechaEmision }}",
    "nombreComprador": "{{ $json.nombreComprador }}",
    "totalBruto": "{{ $json.totalBruto }}",
    "iva": "{{ $json.iva }}",
    "totalPorCobrar": "{{ $json.totalPorCobrar }}",
    "reteica": "{{ $json.reteica }}",
    "reteiva": "{{ $json.reteiva }}",
    "retefuente": "{{ $json.retefuente }}",
    "cufe": "{{ $json.cufe }}"
  }
}
```

**En caso de error:**
```json
{
  "transactionId": "{{ $('Webhook').item.json.transactionId }}",
  "success": false,
  "error": "Error al procesar el PDF: {{ $json.error }}"
}
```

## Flujo de Mensajes en el Cliente

### 1. Usuario sube archivo
```
Mensaje: "☁️ Subiendo archivo a OneDrive..."
```

### 2. Archivo guardado
```
Mensaje: "✅ Archivo guardado en OneDrive"
```

### 3. Webhook activado
```
Mensaje: "🔔 Activando automatización..."
```

### 4. Esperando respuesta
```
Mensaje: "⏳ Esperando respuesta de la automatización..."
```

### 5. n8n devuelve datos
```
Mensaje: "✅ Procesamiento completado"
Acción: Muestra formulario pre-llenado con los datos extraídos
```

## Testing del Callback

Para probar manualmente que el callback funciona:

```bash
curl -X POST https://your-domain.com/api/facturacion-callback \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_test_123",
    "success": true,
    "data": {
      "facturaNo": "13002",
      "fechaEmision": "2026-01-15",
      "nombreComprador": "EMPRESA TEST",
      "totalBruto": "1000000",
      "iva": "190000",
      "totalPorCobrar": "1190000"
    }
  }'
```

## Variables de Entorno Necesarias

Agregar en `.env.local`:

```bash
# URL pública de tu aplicación (para el callback)
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## Troubleshooting

### El cliente no recibe actualizaciones
1. Verificar que el `transactionId` se está generando correctamente
2. Revisar la consola del navegador para ver eventos SSE
3. Verificar que n8n esté enviando el callback con el `transactionId` correcto

### Timeout después de 2 minutos
Si el procesamiento de n8n toma más de 2 minutos:
- Aumentar el timeout en `FacturacionIngresos.tsx` (línea del setTimeout)
- O implementar sistema de polling como alternativa

### n8n no puede alcanzar el callback
- Verificar que `NEXT_PUBLIC_APP_URL` apunte a tu dominio público
- Si estás en desarrollo local, usar ngrok o similar para exponer localhost
- Verificar firewall/CORS si es necesario

## Ejemplo de Workflow n8n Completo

```
[Webhook Trigger] 
    → [Set Variable: transactionId]
    → [HTTP: Download PDF]
    → [Code: Convert to Base64]
    → [HTTP: OpenAI Vision]
    → [Code: Parse Response]
    → [IF: Success?]
        ├─ True → [HTTP: Callback Success]
        └─ False → [HTTP: Callback Error]
```

## Próximos Pasos

1. **Crear workflow en n8n** siguiendo la estructura anterior
2. **Probar con un PDF de factura real**
3. **Verificar que los datos extraídos sean correctos**
4. **Ajustar prompts de AI si es necesario** para mejorar precisión
5. **Implementar guardado en Airtable** después de confirmar datos

---

**NOTA DE SEGURIDAD**: Este archivo contiene información de configuración general. Los webhooks, URLs y credenciales específicas deben configurarse directamente en las variables de entorno y n8n, nunca en archivos versionados.

