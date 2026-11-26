import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * GET: Listar solicitudes de compra recientes (últimas 2)
 * DELETE: Eliminar solicitudes de compra y sus PDFs
 */
export async function GET() {
  try {
    const comprasTable = base(process.env.AIRTABLE_COMPRAS_TABLE_ID!);

    // Obtener últimas 2 solicitudes
    const records = await comprasTable
      .select({
        maxRecords: 2,
        sort: [{ field: 'Fecha Solicitud', direction: 'desc' }],
      })
      .firstPage();

    const solicitudes = records.map(r => ({
      id: r.id,
      nombreSolicitante: r.get('Solicitante') as string,
      fecha: r.get('Fecha Solicitud') as string,
      numeroItems: (r.get('Items') as string[] || []).length,
      pdfUrl: r.get('Documento PDF') as string,
      estado: r.get('Estado') as string,
    }));

    return NextResponse.json({
      success: true,
      solicitudes,
      message: `Encontradas ${solicitudes.length} solicitudes recientes. Para eliminarlas, haz DELETE a esta misma URL.`,
    });

  } catch (error) {
    console.error('Error listando solicitudes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmar = searchParams.get('confirmar');

    if (confirmar !== 'si') {
      return NextResponse.json({
        success: false,
        error: 'Debes confirmar la eliminación agregando ?confirmar=si a la URL',
      }, { status: 400 });
    }

    const comprasTable = base(process.env.AIRTABLE_COMPRAS_TABLE_ID!);
    const itemsTable = base(process.env.AIRTABLE_ITEMS_TABLE_ID!);

    // Obtener últimas 2 solicitudes
    const records = await comprasTable
      .select({
        maxRecords: 2,
        sort: [{ field: 'Fecha Solicitud', direction: 'desc' }],
      })
      .firstPage();

    const resultados = [];

    for (const record of records) {
      const solicitudId = record.id;
      const pdfUrl = record.get('Documento PDF') as string;
      const itemsIds = (record.get('Items') as string[]) || [];

      // 1. Eliminar PDF de S3 si existe
      if (pdfUrl && pdfUrl.includes('siriusadministrativo.s3')) {
        try {
          const key = pdfUrl.split('.amazonaws.com/')[1];
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: decodeURIComponent(key),
          }));
          console.log(`✅ PDF eliminado de S3: ${key}`);
        } catch (error) {
          console.error('Error eliminando PDF de S3:', error);
        }
      }

      // 2. Eliminar items relacionados
      if (itemsIds.length > 0) {
        try {
          // Airtable permite eliminar hasta 10 registros a la vez
          const chunks = [];
          for (let i = 0; i < itemsIds.length; i += 10) {
            chunks.push(itemsIds.slice(i, i + 10));
          }

          for (const chunk of chunks) {
            await itemsTable.destroy(chunk);
          }
          console.log(`✅ ${itemsIds.length} items eliminados`);
        } catch (error) {
          console.error('Error eliminando items:', error);
        }
      }

      // 3. Eliminar solicitud
      await comprasTable.destroy(solicitudId);
      console.log(`✅ Solicitud eliminada: ${solicitudId}`);

      resultados.push({
        solicitudId,
        pdfEliminado: !!pdfUrl,
        itemsEliminados: itemsIds.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${resultados.length} solicitudes de prueba eliminadas`,
      resultados,
    });

  } catch (error) {
    console.error('Error eliminando pruebas:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
