import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configurar Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID!);

// ID de la tabla de Remisiones Laboratorio
const REMISIONES_LABORATORIO_TABLE_ID = process.env.AIRTABLE_REMISIONES_LABORATORIO_TABLE_ID;

// Helper function para convertir valores a números de forma segura
function parseNumber(value: any): number {
  if (Array.isArray(value)) {
    return parseNumber(value[0]);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📄 Iniciando consulta de remisiones sin facturar...');
    
    // Validar que la variable de entorno esté configurada
    if (!REMISIONES_LABORATORIO_TABLE_ID) {
      console.error('❌ AIRTABLE_REMISIONES_LABORATORIO_TABLE_ID no está configurada');
      return NextResponse.json(
        { success: false, error: 'Configuración de tabla no encontrada' },
        { status: 500 }
      );
    }
    
    // Obtener remisiones sin facturar usando la variable de entorno
    const remisionesRecords = await base(REMISIONES_LABORATORIO_TABLE_ID)
      .select({
        filterByFormula: `AND(
          {Factura Relacionada} = BLANK(),
          {Nombre Clientes Laboratorio} != "SIRIUS REGENERATIVE SOLUTIONS S.A.S ZOMAC"
        )`
      })
      .all();

    console.log(`� Total remisiones sin facturar encontradas: ${remisionesRecords.length}`);

    // Transformar los datos
    const remisiones = remisionesRecords.map((record) => {
      const fields = record.fields;
      
      // Buscar los campos correctos por nombre
      const totalLitros = parseNumber(fields['Total Litros']);
      const valorTotalLitros = parseNumber(fields['Valor Total Litros']);
      const nombreCliente = fields['Nombre Clientes Laboratorio']?.toString() || '';
      
      console.log(`🔍 Procesando ${record.id}: Cliente="${nombreCliente}", Litros=${totalLitros}, Valor=${valorTotalLitros}`);
      
      return {
        id: record.id,
        numeroRemision: parseNumber(fields['Numero Remision']),
        nombreCliente,
        nitCliente: fields['NIT Clientes Laboratorio']?.toString() || '',
        totalLitros,
        valorTotalLitros,
        fechaCreacion: fields['Fecha Creacion'] || null
      };
    })
    .filter(remision => remision.valorTotalLitros > 0); // Solo incluir remisiones con valor

    // Calcular totales
    const totalRemisiones = remisiones.length;
    const totalLitros = remisiones.reduce((sum, remision) => sum + remision.totalLitros, 0);
    const valorTotal = remisiones.reduce((sum, remision) => sum + remision.valorTotalLitros, 0);

    console.log(`✅ Resumen remisiones sin facturar:`, {
      totalRemisiones,
      totalLitros,
      valorTotal
    });

    return NextResponse.json({
      success: true,
      data: remisiones,
      summary: {
        totalRemisiones,
        totalLitros,
        valorTotal
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener remisiones sin facturar:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}