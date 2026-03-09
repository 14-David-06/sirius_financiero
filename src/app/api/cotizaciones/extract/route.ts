import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json({ error: 'Configuración de almacenamiento faltante' }, { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Configuración de OpenAI faltante' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const compraId = formData.get('compraId') as string;
    const proveedorNombre = formData.get('proveedorNombre') as string || 'SinProveedor';
    const solicitanteNombre = formData.get('solicitanteNombre') as string || 'SinNombre';

    if (!file || !compraId) {
      return NextResponse.json({ error: 'Archivo y ID de compra son requeridos' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF e imágenes (JPG, PNG, WebP)' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máximo 10MB)' }, { status: 400 });
    }

    // 1. Subir archivo a S3
    const fechaActual = new Date().toISOString().split('T')[0];
    const extension = file.name.split('.').pop();
    const safeProv = proveedorNombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
    const safeSol = solicitanteNombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
    const fileName = `siriusadministrativo[${safeProv}][${safeSol}][${fechaActual}].${extension}`;
    const fullPath = `cotizaciones/${fileName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fullPath,
      Body: buffer,
      ContentType: file.type,
      ContentDisposition: 'inline',
      Metadata: {
        'original-name': file.name,
        'proveedor': safeProv,
        'solicitante': safeSol,
        'fecha-upload': new Date().toISOString(),
        'tipo-documento': 'cotizacion',
      }
    }));

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fullPath}`;

    // 2. Extraer datos con OpenAI Vision
    const base64File = buffer.toString('base64');
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
    
    let imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart;
    
    if (file.type === 'application/pdf') {
      // Para PDFs, enviar como file input
      imageContent = {
        type: 'file' as any,
        file: {
          filename: file.name,
          file_data: `data:application/pdf;base64,${base64File}`,
        },
      } as any;
    } else {
      imageContent = {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64File}`,
          detail: 'high',
        },
      };
    }

    const prompt = `Eres un experto en analizar documentos de cotización de proveedores colombianos. Analiza este documento y extrae la siguiente información en formato JSON estricto.

INSTRUCCIONES:
- Extrae TODOS los items/productos/servicios listados en la cotización
- Los valores monetarios deben ser números sin formato (sin signos de pesos ni puntos de miles)
- Si un campo no se encuentra, usa null
- La fecha debe estar en formato YYYY-MM-DD
- Para unidad de medida, normaliza a una de estas opciones: "Unidad", "Kg", "Lt", "Galon", "m2", "m3", "Caja", "Bulto", "Rollo", "Paquete", "Global", "Servicio"

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código:

{
  "proveedor": {
    "nombre": "string | null",
    "nit": "string | null",
    "ciudad": "string | null",
    "telefono": "string | null",
    "correo": "string | null"
  },
  "cotizacion": {
    "numero": "string | null",
    "fecha": "YYYY-MM-DD | null",
    "validez": "string | null",
    "formaPago": "string | null",
    "tiempoEntrega": "string | null",
    "comentarios": "string | null"
  },
  "items": [
    {
      "descripcion": "string",
      "cantidad": number,
      "unidadMedida": "string",
      "valorUnitario": number,
      "valorTotal": number,
      "comentarios": "string | null"
    }
  ],
  "valorTotal": number | null
}`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageContent,
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const rawContent = chatResponse.choices[0]?.message?.content || '{}';
    
    // Limpiar respuesta: remover bloques de código si los hay
    const cleanedContent = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let extractedData;
    try {
      extractedData = JSON.parse(cleanedContent);
    } catch {
      console.error('Error parsing OpenAI response:', rawContent);
      return NextResponse.json({
        success: true,
        fileUrl,
        extractedData: null,
        rawResponse: rawContent,
        message: 'Archivo subido pero no se pudo extraer la información automáticamente'
      });
    }

    return NextResponse.json({
      success: true,
      fileUrl,
      extractedData,
      message: 'Archivo subido y datos extraídos exitosamente'
    });

  } catch (error) {
    console.error('Error en extracción de cotización:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
