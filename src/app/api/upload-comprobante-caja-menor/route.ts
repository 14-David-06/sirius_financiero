import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configurar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  console.log('📤 API de carga de comprobante de caja menor iniciado');
  
  try {
    // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.error('❌ Missing AWS S3 credentials');
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const carpetaCajaMenor = formData.get('carpetaCajaMenor') as string;
    const beneficiario = formData.get('beneficiario') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (!carpetaCajaMenor) {
      return NextResponse.json(
        { error: 'No se especificó la carpeta de caja menor' },
        { status: 400 }
      );
    }

    console.log('📁 Subiendo a carpeta:', carpetaCajaMenor);
    console.log('📄 Archivo:', file.name, '- Tamaño:', file.size, 'bytes');

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo se aceptan PDF o imágenes (JPG, PNG)' },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo no debe superar los 10MB' },
        { status: 400 }
      );
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generar nombre único para el archivo
    const timestamp = new Date().getTime();
    const beneficiarioSlug = beneficiario.replace(/\s+/g, '-').toLowerCase();
    const extension = file.name.split('.').pop();
    const fileName = `comprobante-${beneficiarioSlug}-${timestamp}.${extension}`;

    // Ruta completa en S3: caja_menor/[carpeta_mes_año]/[archivo]
    const s3Key = `caja_menor/${carpetaCajaMenor}/${fileName}`;

    console.log('☁️ Subiendo a S3:', s3Key);

    // Subir archivo a S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('✅ Archivo subido exitosamente a S3');

    // Generar URL pública del archivo
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
    console.log('🔗 URL del archivo:', fileUrl);

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName,
      carpeta: carpetaCajaMenor,
      message: 'Comprobante subido exitosamente'
    });

  } catch (error) {
    console.error('❌ Error subiendo comprobante:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al subir el archivo',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
