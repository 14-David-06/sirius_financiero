import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Flujo de Caja
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

const MOVIMIENTOS_TABLE_ID = process.env.AIRTABLE_MOVIMIENTOS_TABLE_ID || '';

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !MOVIMIENTOS_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🔄 API /movimientos-pirolisis iniciando...');
    console.log('🔑 API Key disponible:', !!AIRTABLE_API_KEY);
    console.log('🗄️ Base ID:', AIRTABLE_BASE_ID);
    console.log('📊 Table ID:', MOVIMIENTOS_TABLE_ID);

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '10000');
    const tipoGasto = searchParams.get('tipo') || 'ambos'; // gastos, costos, ambos

    const records: Record<string, unknown>[] = [];

    // Construir filtro dinámico según el tipo de gasto
    let grupoFilter = '';
    if (tipoGasto === 'gastos') {
      grupoFilter = 'FIND("Gasto", {GRUPO PRUEBA})';
    } else if (tipoGasto === 'costos') {
      grupoFilter = 'FIND("Costo", {GRUPO PRUEBA})';
    } else {
      // ambos
      grupoFilter = 'OR(FIND("Costo", {GRUPO PRUEBA}), FIND("Gasto", {GRUPO PRUEBA}))';
    }

    const filterFormula = `AND(
      {Valor} < 0,
      ${grupoFilter},
      {Unidad de Negocio Prueba} = "Pirolisis"
    )`;

    console.log('📡 Consultando Airtable con filtro de Pirólisis...');
    console.log('🔍 Tipo de gasto:', tipoGasto);
    console.log('🔍 Filtro aplicado:', filterFormula);
    
    await base(MOVIMIENTOS_TABLE_ID)
      .select({
        maxRecords,
        filterByFormula: filterFormula,
        sort: [{ field: 'Fecha', direction: 'desc' }],
      })
      .eachPage((pageRecords, fetchNextPage) => {
        console.log('📄 Página recibida con', pageRecords.length, 'registros');
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            ...record.fields,
          });
        });
        fetchNextPage();
      });

    console.log('✅ Total de registros obtenidos:', records.length);

    if (records.length === 0) {
      console.warn('⚠️ No se encontraron registros con el filtro aplicado');
      return NextResponse.json({ 
        records: [], 
        costosPorSemana: {},
        totales: {
          totalRegistros: 0,
          totalGeneral: 0,
          promedioMovimiento: 0,
          semanasUnicas: 0,
          registrosConSemana: 0
        },
        warning: 'No se encontraron registros',
        success: true 
      });
    }

    // Agrupar costos por número de semana (sin considerar año)
    const costosPorSemana: Record<number, number> = {};
    let registrosProcesados = 0;
    let registrosConSemana = 0;
    
    records.forEach((record) => {
      registrosProcesados++;
      
      // Buscar el campo de semana - EL CAMPO CORRECTO ES "Numero semana formulado" (sin "a")
      const semana = record['Numero semana formulado'] ||  // ✅ ESTE ES EL CORRECTO
                     record['Numero semana formulada'] ||  
                     record['Número semana formulado'] || 
                     record['Número semana formulada'] || 
                     record['Numero Semana Formulado'] ||
                     record['semana'];
      const recordValor = record.Valor as number | undefined;
      const valor = Math.abs(recordValor || 0);
      
      if (semana !== undefined && semana !== null && !isNaN(Number(semana))) {
        registrosConSemana++;
        const semanaNum = typeof semana === 'number' ? semana : parseInt(String(semana));
        if (!costosPorSemana[semanaNum]) {
          costosPorSemana[semanaNum] = 0;
        }
        costosPorSemana[semanaNum] += valor;
      }
    });

    // Calcular totales generales
    const totalGeneral = records.reduce((sum, r) => {
      const rValor = r.Valor as number | undefined;
      return sum + Math.abs(rValor || 0);
    }, 0);
    const promedioMovimiento = registrosProcesados > 0 ? totalGeneral / registrosProcesados : 0;

    console.log('📊 Resumen de procesamiento:');
    console.log(`   - Total registros: ${registrosProcesados}`);
    console.log(`   - Registros con semana: ${registrosConSemana}`);
    console.log(`   - Semanas únicas: ${Object.keys(costosPorSemana).length}`);
    console.log(`   - Total general: $${Math.round(totalGeneral).toLocaleString('es-CO')}`);
    console.log('💰 Costos agrupados por semana:', costosPorSemana);
    
    return NextResponse.json({ 
      records, 
      costosPorSemana,
      totales: {
        totalRegistros: registrosProcesados,
        totalGeneral,
        promedioMovimiento,
        semanasUnicas: Object.keys(costosPorSemana).length,
        registrosConSemana
      },
      success: true 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error fetching movimientos:', error);
    console.error('❌ Error details:', errorMessage);
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    );
  }
}
