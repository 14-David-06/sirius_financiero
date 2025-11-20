import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Configuración de AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const FIRMAS_MAP = {
  'martin': process.env.SIGNATURE_MARTIN_PATH!,
  'joys': process.env.SIGNATURE_JOYS_PATH!
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  try {
    const { tipo } = await params;

    // Validar que el tipo de firma existe
    if (!FIRMAS_MAP[tipo as keyof typeof FIRMAS_MAP]) {
      return NextResponse.json(
        { error: 'Tipo de firma no válido' },
        { status: 400 }
      );
    }

    const key = FIRMAS_MAP[tipo as keyof typeof FIRMAS_MAP];
    const bucket = process.env.AWS_S3_BUCKET!;

    console.log(`🔐 Solicitando firma: ${tipo} -> ${key}`);

    // Obtener el objeto de S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: 'Firma no encontrada' },
        { status: 404 }
      );
    }

    // Convertir el stream a buffer
    const buffer = Buffer.from(await response.Body.transformToByteArray());

    // Determinar el content type
    const contentType = key.endsWith('.png') ? 'image/png' : 'image/jpeg';

    console.log(`✅ Firma ${tipo} servida exitosamente`);

    // Devolver la imagen con headers de seguridad
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    });

  } catch (error) {
    console.error('❌ Error obteniendo firma:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}