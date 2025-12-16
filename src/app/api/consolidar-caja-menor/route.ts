import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Airtable from 'airtable';
import { CAJA_MENOR_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Configuración de Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const CAJA_MENOR_TABLE_ID = process.env.CAJA_MENOR_TABLE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

export async function POST(request: NextRequest) {
  console.log('🔥 API de consolidación de caja menor iniciado');
  
  try {
    // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.error('❌ Missing AWS S3 credentials');
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const { cajaMenorId, pdfBuffer, nombreCarpeta, fechaConsolidacion } = await request.json();

    console.log('📄 Consolidando caja menor:', {
      cajaMenorId,
      nombreCarpeta,
      fechaConsolidacion,
      pdfSize: pdfBuffer ? Buffer.from(pdfBuffer).length : 0
    });

    if (!cajaMenorId || !pdfBuffer || !nombreCarpeta || !fechaConsolidacion) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // Convertir el buffer del PDF
    const pdfBufferData = Buffer.from(pdfBuffer);

    // Subir PDF a S3
    const fileName = `consolidacion-${new Date().getTime()}.pdf`;
    const s3Key = `caja_menor/${nombreCarpeta}/${fileName}`;
    
    console.log('☁️ Subiendo PDF a S3:', s3Key);

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: pdfBufferData,
      ContentType: 'application/pdf',
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('✅ PDF subido a S3 exitosamente');

    const pdfUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
    console.log('🔗 URL del PDF:', pdfUrl);

    // Actualizar el registro de Caja Menor en Airtable
    console.log('📝 Actualizando registro en Airtable:', cajaMenorId);

    await base(CAJA_MENOR_TABLE_ID).update(cajaMenorId, {
      [CAJA_MENOR_FIELDS.FECHA_CONSOLIDACION]: fechaConsolidacion,
      [CAJA_MENOR_FIELDS.DOCUMENTO_CONSOLIDACION]: [{
        url: pdfUrl,
        filename: fileName
      }] as any,
      [CAJA_MENOR_FIELDS.URL_S3]: pdfUrl // Guardar URL original de S3 para poder eliminar el archivo posteriormente
    });

    console.log('✅ Registro de Caja Menor actualizado exitosamente');
    console.log('🔗 URL S3 guardada para futura eliminación:', pdfUrl);

    return NextResponse.json({
      success: true,
      pdfUrl,
      fileName,
      message: 'Caja menor consolidada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error consolidando caja menor:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido al consolidar',
      success: false
    }, { status: 500 });
  }
}
