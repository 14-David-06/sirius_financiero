import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';
import { PROYECCIONES_FIELDS } from '@/lib/config/airtable-fields';

// Variables de entorno para la tabla de proyecciones
const PROYECCIONES_TABLE_ID = process.env.AIRTABLE_PROYECCIONES_TABLE_ID;

export async function GET(request: NextRequest) {
  try {
    if (!PROYECCIONES_TABLE_ID) {
      console.error('❌ Falta variable de entorno: AIRTABLE_PROYECCIONES_TABLE_ID');
      return NextResponse.json(
        { success: false, error: 'Configuración incompleta del servidor' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const año = searchParams.get('año');
    const semana = searchParams.get('semana');

    console.log('📊 [API Proyecciones] Iniciando consulta:', { 
      año, 
      semana, 
      tableId: PROYECCIONES_TABLE_ID 
    });

    // Construir filtro según parámetros
    let filterFormula = '';
    const filters: string[] = [];

    if (año) {
      filters.push(`{${PROYECCIONES_FIELDS.ANO_FORMULADO}} = ${año}`);
    }
    if (semana) {
      filters.push(`{${PROYECCIONES_FIELDS.SEMANA_FORMULADA}} = ${semana}`);
    }
    
    // Filtrar solo registros con presupuesto mayor a 0
    filters.push(`{${PROYECCIONES_FIELDS.VR_PRESUPUESTO}} > 0`);

    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
    }

    console.log('🔍 [API Proyecciones] Filtro aplicado:', filterFormula);

    const records = await base(PROYECCIONES_TABLE_ID!)
      .select({
        filterByFormula: filterFormula || undefined,
      })
      .all();
    
    console.log(`✅ [API Proyecciones] Registros obtenidos: ${records.length}`);

    console.log(`✅ Registros encontrados: ${records.length}`);

    const data = records.map((record) => ({
      id: record.id,
      año: record.get(PROYECCIONES_FIELDS.ANO_FORMULADO),
      semana: record.get(PROYECCIONES_FIELDS.SEMANA_FORMULADA),
      mes: record.get(PROYECCIONES_FIELDS.MES),
      vrPresupuesto: Number(record.get(PROYECCIONES_FIELDS.VR_PRESUPUESTO)) || 0,
      concepto: record.get(PROYECCIONES_FIELDS.CONCEPTO),
      clasificacion: record.get(PROYECCIONES_FIELDS.CLASIFICACION),
      tipoMovimiento: record.get(PROYECCIONES_FIELDS.TIPO_MOVIMIENTO),
      tipoProyeccion: record.get(PROYECCIONES_FIELDS.TIPO_PROYECCION),
      grupo: record.get(PROYECCIONES_FIELDS.GRUPO),
      clase: record.get(PROYECCIONES_FIELDS.CLASE),
    }));

    console.log('📊 [API Proyecciones] Primeros registros:', data.slice(0, 3));

    // Calcular totales usando el campo "Tipo de Proyección"
    const totales = {
      totalIngresos: data
        .filter(item => 
          item.tipoProyeccion === 'Ingresos Contables (Por Facturación)' || 
          item.tipoProyeccion === 'Otros Ingresos'
        )
        .reduce((sum, item) => sum + (item.vrPresupuesto || 0), 0),
      totalEgresos: data
        .filter(item => item.grupo === 'Egreso')
        .reduce((sum, item) => sum + Math.abs(item.vrPresupuesto || 0), 0),
      ingresosOperacionales: data
        .filter(item => item.tipoProyeccion === 'Ingresos Contables (Por Facturación)')
        .reduce((sum, item) => sum + (item.vrPresupuesto || 0), 0),
      ingresosNoOperacionales: data
        .filter(item => item.tipoProyeccion === 'Otros Ingresos')
        .reduce((sum, item) => sum + (item.vrPresupuesto || 0), 0),
    };

    console.log('💰 Totales calculados:', totales);

    return NextResponse.json({ 
      success: true, 
      data,
      totales,
      total: data.length 
    });

  } catch (error) {
    console.error('❌ [API Proyecciones] Error detallado:', error);
    console.error('❌ [API Proyecciones] Stack:', error instanceof Error ? error.stack : 'No stack available');
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Error al obtener datos de proyecciones: ${errorMessage}`,
        details: {
          tableId: PROYECCIONES_TABLE_ID,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }
      },
      { status: 500 }
    );
  }
}
