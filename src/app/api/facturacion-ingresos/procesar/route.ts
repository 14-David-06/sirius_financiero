import { NextRequest, NextResponse } from 'next/server';
import {
  extraerDatosIngresos,
  procesarFacturaIngresos,
  facturaIngresoYaProcesada,
  type FacturaIngresoProcesada,
} from '@/lib/facturacion/ingresos-processor';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Procesar Factura de Ingresos
 *
 * POST /api/facturacion-ingresos/procesar
 * Reemplaza el webhook n8n "AUTOMA_Facturacion_Ingresos" (PNFz0ARog6xwIqKU).
 *
 * Body: multipart/form-data con campo "file" (PDF)
 *
 * MEJORAS vs n8n:
 * - ✅ BUG CORREGIDO: IVA ya NO se guarda con valor de reteica
 * - ✅ Procesamiento inline (sin webhook + callback)
 * - ✅ Respuesta síncrona con datos completos
 * - ✅ Una sola llamada LLM (Claude Haiku con JSON)
 * - ✅ PDF en base64 (sin S3 público)
 * - ✅ Deduplicación antes de procesar
 *
 * Requiere autenticación
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let decoded: { nombre: string; categoria: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { nombre: string; categoria: string };
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const inicio = Date.now();
    console.log(`🔄 [Facturación Ingresos] Iniciando - usuario: ${decoded.nombre}`);

    // 2. Leer archivo del FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const idDocumento = formData.get('idDocumento') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    if (!idDocumento) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ID de documento' },
        { status: 400 }
      );
    }

    console.log(`📄 [Facturación Ingresos] Archivo: ${file.name} (${file.size} bytes)`);

    // 3. Verificar si ya fue procesada
    const yaProcesada = await facturaIngresoYaProcesada(idDocumento);
    if (yaProcesada) {
      console.log(`⏭️ [Facturación Ingresos] Ya procesada: ${idDocumento}`);
      return NextResponse.json({
        success: false,
        data: {
          error: 'Factura ya procesada, validar registros en Airtable',
        },
      });
    }

    // 4. Convertir a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // 5. Extraer datos con IA
    const datosExtraidos = await extraerDatosIngresos(pdfBuffer, file.name);

    // 6. Procesar factura
    const facturaCreada = await procesarFacturaIngresos(datosExtraidos, idDocumento);

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log(`✅ [Facturación Ingresos] Completado en ${duracion}s:`, {
      factura: facturaCreada.numeroFactura,
      comprador: facturaCreada.comprador,
      monto: facturaCreada.monto,
    });

    // 7. Respuesta con datos completos (compatible con frontend)
    return NextResponse.json({
      success: true,
      data: facturaCreada.data,
      facturaId: facturaCreada.id,
      duracionSegundos: parseFloat(duracion),
    });
  } catch (error) {
    console.error('❌ [Facturación Ingresos] Error:', error);

    return NextResponse.json(
      {
        success: false,
        data: {
          error: 'Error al procesar factura de ingresos',
        },
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

// Claude + procesar puede tardar 10-40s
export const maxDuration = 60;
