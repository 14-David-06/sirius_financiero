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
  try {
    // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.error('Missing AWS S3 credentials');
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const proveedorNombre = formData.get('proveedorNombre') as string;
    const solicitanteNombre = formData.get('solicitanteNombre') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    if (!proveedorNombre || !solicitanteNombre) {
      return NextResponse.json(
        { error: 'Faltan datos del proveedor o solicitante' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Solo se permiten PDF e imágenes.' },
        { status: 400 }
      );
    }

    // Verificar tamaño (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máximo 10MB)' },
        { status: 400 }
      );
    }

    console.log(`Subiendo archivo: ${file.name}, ${file.size} bytes, ${file.type}`);

    try {
      // Generar nombre del archivo según el formato requerido
      const fechaActual = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = file.name.split('.').pop();
      const fileName = `siriusadministrativo[${proveedorNombre}][${solicitanteNombre}][${fechaActual}].${extension}`;
      const fullPath = `cotizaciones/${fileName}`;
      
      console.log(`Nombre del archivo en S3: ${fullPath}`);

      // Convertir archivo a buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Configurar parámetros para S3
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: fullPath,
        Body: buffer,
        ContentType: file.type,
        ContentDisposition: 'inline',
        Metadata: {
          'original-name': file.name,
          'proveedor': proveedorNombre,
          'solicitante': solicitanteNombre,
          'fecha-upload': new Date().toISOString(),
          'tipo-documento': 'cotizacion'
        }
      };

      // Subir archivo a S3
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      // Generar URL del archivo
      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fullPath}`;

      console.log('Archivo subido exitosamente a S3:', fileUrl);

      return NextResponse.json({
        success: true,
        fileUrl: fileUrl,
        fileName: fileName,
        fullPath: fullPath,
        metadata: {
          originalName: file.name,
          size: file.size,
          type: file.type,
          proveedor: proveedorNombre,
          solicitante: solicitanteNombre,
          fechaUpload: fechaActual
        }
      });

    } catch (uploadError) {
      console.error('Error subiendo archivo a S3:', uploadError);
      
      return NextResponse.json(
        { 
          error: 'Error subiendo el archivo al almacenamiento',
          details: process.env.NODE_ENV === 'development' ? uploadError : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error procesando upload:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de upload de archivos a S3 activa',
    supported_formats: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    max_file_size: '10MB',
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
    output_folder: 'cotizaciones/',
    naming_format: 'siriusadministrativo[Proveedor][Solicitante][YYYY-MM-DD].ext'
  });
}
