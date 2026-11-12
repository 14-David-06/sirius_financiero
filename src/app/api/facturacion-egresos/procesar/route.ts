import { NextRequest, NextResponse } from 'next/server';
import {
  extraerDatosConClaude,
  procesarFactura,
  facturaYaProcesada,
  type FacturaProcesada,
} from '@/lib/facturacion/egresos-processor';
import {
  buscarCarpetaEgresosActual,
  listarPDFsPendientes,
  descargarArchivo,
} from '@/lib/facturacion/onedrive-egresos';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

interface ResultadoProcesamiento {
  success: boolean;
  message: string;
  facturasCreadas: FacturaProcesada[];
  totalFacturas: number;
  omitidas?: number;
  errores?: Array<{ archivo: string; error: string }>;
  carpetaProcesada?: string;
}

/**
 * Procesar Facturas de Egresos
 *
 * POST /api/facturacion-egresos/procesar
 * Reemplaza el workflow n8n "AUTOMA_Facturacion_Egresos" (LfS7vJdMi9VgDA3k).
 *
 * MEJORAS vs n8n:
 * - ✅ Búsqueda INTELIGENTE de carpeta (mes actual vs. hardcoded "6. Junio")
 * - ✅ Fecha de emisión REAL (extraída del PDF vs. fija 2026-06-30)
 * - ✅ Respuesta síncrona con lista de facturas procesadas
 * - ✅ Manejo de errores robusto (continúa procesando aunque falle una factura)
 * - ✅ Claude Opus 4.6 para extracción (como indica el título del workflow)
 * - ✅ Deduplicación por ID_DOC antes de procesar
 *
 * Requiere autenticación (categoría: Administrador, Gerencia, Desarrollador)
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

    // Verificar permisos
    const categoriasPermitidas = ['Administrador', 'Gerencia', 'Desarrollador'];
    if (!categoriasPermitidas.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Sin permisos para ejecutar esta operación' },
        { status: 403 }
      );
    }

    const inicio = Date.now();
    console.log(`🔄 [Facturación Egresos] Iniciando procesamiento - usuario: ${decoded.nombre}`);

    // 2. Buscar carpeta del mes actual (BÚSQUEDA INTELIGENTE)
    let carpetaId: string;
    try {
      carpetaId = await buscarCarpetaEgresosActual();
    } catch (error) {
      console.error('❌ [Facturación Egresos] Error buscando carpeta:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontró la carpeta de facturas del mes actual',
          detalles: error instanceof Error ? error.message : 'Error desconocido',
        },
        { status: 404 }
      );
    }

    // 3. Listar PDFs pendientes
    const archivos = await listarPDFsPendientes(carpetaId);

    if (archivos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron facturas pendientes para procesar',
        facturasCreadas: [],
        totalFacturas: 0,
        carpetaProcesada: carpetaId,
      });
    }

    console.log(`📊 [Facturación Egresos] ${archivos.length} PDFs encontrados`);

    // 4. Procesar cada factura
    const facturasCreadas: FacturaProcesada[] = [];
    const errores: Array<{ archivo: string; error: string }> = [];
    let omitidas = 0;

    for (const archivo of archivos) {
      try {
        console.log(`\n📄 [Facturación Egresos] Procesando: ${archivo.name}`);

        // Verificar si ya fue procesada
        const yaProcesada = await facturaYaProcesada(archivo.id);
        if (yaProcesada) {
          console.log(`⏭️ [Facturación Egresos] Ya procesada, omitiendo: ${archivo.name}`);
          omitidas++;
          facturasCreadas.push({
            id: '',
            numeroFactura: archivo.name,
            proveedor: '',
            monto: 0,
            omitida: true,
            razon: 'Ya procesada (ID_DOC duplicado)',
          });
          continue;
        }

        // Descargar PDF
        const pdfBuffer = await descargarArchivo(archivo.id);

        // Extraer datos con IA
        const datosExtraidos = await extraerDatosConClaude(pdfBuffer, archivo.name);

        // Procesar factura (crear cabecera, centralizar, crear ítems)
        const facturaCreada = await procesarFactura(datosExtraidos, archivo.id);

        facturasCreadas.push(facturaCreada);

        console.log(`✅ [Facturación Egresos] Factura procesada: ${facturaCreada.numeroFactura}`);
      } catch (error) {
        console.error(`❌ [Facturación Egresos] Error procesando ${archivo.name}:`, error);
        errores.push({
          archivo: archivo.name,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });

        // Continuar con el siguiente archivo (NO detener el proceso)
      }
    }

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    const resultado: ResultadoProcesamiento = {
      success: true,
      message: `Procesamiento completado: ${facturasCreadas.length - omitidas} facturas creadas, ${omitidas} omitidas, ${errores.length} errores`,
      facturasCreadas,
      totalFacturas: facturasCreadas.length,
      omitidas,
      ...(errores.length > 0 && { errores }),
      carpetaProcesada: carpetaId,
    };

    console.log(`✅ [Facturación Egresos] Completado en ${duracion}s:`, {
      creadas: facturasCreadas.length - omitidas,
      omitidas,
      errores: errores.length,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('❌ [Facturación Egresos] Error general:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar facturas de egresos',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

// Aumentar maxDuration: Claude + OpenAI por factura puede tardar 20-60s cada una
export const maxDuration = 300; // 5 minutos
