import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Flujo de Caja
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const FACTURACION_EGRESOS_TABLE_ID = process.env.AIRTABLE_FACTURACION_EGRESOS_TABLE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !FACTURACION_EGRESOS_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      console.error('   - AIRTABLE_API_KEY:', !!AIRTABLE_API_KEY);
      console.error('   - AIRTABLE_BASE_ID:', !!AIRTABLE_BASE_ID);
      console.error('   - AIRTABLE_FACTURACION_EGRESOS_TABLE_ID:', !!FACTURACION_EGRESOS_TABLE_ID);
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🔄 API /facturacion-egresos-pirolisis iniciando...');
    console.log('🔑 API Key disponible:', !!AIRTABLE_API_KEY);
    console.log('🗄️ Base ID:', AIRTABLE_BASE_ID);
    console.log('📊 Table ID:', FACTURACION_EGRESOS_TABLE_ID);

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '10000');
    const mesAnterior = searchParams.get('mesAnterior') || 'Septiembre'; // Por defecto septiembre

    const records: Record<string, unknown>[] = [];

    // Filtro específico para Pirólisis Biochar Puro en el mes anterior
    const filterFormula = `AND(
      {Mes formulado} = "${mesAnterior}",
      {GRUPO} = "Costo",
      {C. Costos} = "Pirolisis",
      {Producto Terminado} = "Biochar Puro"
    )`;

    console.log('📡 Consultando Airtable con filtros específicos de Facturación Egresos Pirólisis...');
    console.log('🔍 Mes anterior:', mesAnterior);
    console.log('🔍 Filtros aplicados:');
    console.log('   - Mes formulado =', mesAnterior);
    console.log('   - GRUPO = "Costo"');
    console.log('   - C. Costos = "Pirolisis"');
    console.log('   - Producto Terminado = "Biochar Puro"');
    console.log('🔍 Fórmula completa:', filterFormula);
    
    await base(FACTURACION_EGRESOS_TABLE_ID)
      .select({
        maxRecords,
        filterByFormula: filterFormula,
        sort: [{ field: 'fldUNbpkTClS33IQ4', direction: 'desc' }], // Ordenar por Fecha de Emisión
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
    
    // Verificar campos en los primeros 5 registros
    if (records.length > 0) {
      console.log('');
      console.log('🔍 Muestra de los primeros 5 registros:');
      records.slice(0, 5).forEach((record, index) => {
        console.log(`   ${index + 1}. Mes: "${record['Mes formulado'] || 'VACÍO'}" | GRUPO: "${record['GRUPO'] || 'VACÍO'}" | C. Costos: "${record['C. Costos'] || 'VACÍO'}" | Producto: "${record['Producto Terminado'] || 'VACÍO'}"`);
        console.log(`      Total a Pagar: ${record['total_pagar'] || 0} | Semana: ${record['Numero de la semana'] || 'VACÍO'}`);
      });
      console.log('');
    }

    if (records.length === 0) {
      console.warn('⚠️ No se encontraron registros con el filtro aplicado para', mesAnterior);
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
        warning: `No se encontraron registros para ${mesAnterior}`,
        success: true 
      });
    }

    // Agrupar costos por número de semana
    const costosPorSemana: Record<number, number> = {};
    let registrosProcesados = 0;
    let registrosConSemana = 0;
    
    records.forEach((record) => {
      registrosProcesados++;
      
      // Obtener el número de semana
      const semana = record['Numero de la semana'];
      const totalPagar = record['total_pagar'] as number | undefined;
      const valor = Math.abs(totalPagar || 0);
      
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
      const totalPagar = r['total_pagar'] as number | undefined;
      return sum + Math.abs(totalPagar || 0);
    }, 0);
    const promedioMovimiento = registrosProcesados > 0 ? totalGeneral / registrosProcesados : 0;

    console.log('📊 Resumen de procesamiento:');
    console.log(`   - Total registros devueltos por Airtable: ${registrosProcesados}`);
    console.log(`   - Registros con número de semana válido: ${registrosConSemana}`);
    console.log(`   - Semanas únicas encontradas: ${Object.keys(costosPorSemana).length}`);
    console.log(`   - Total general de costos: $${totalGeneral.toLocaleString()}`);
    console.log(`   - Promedio por registro: $${promedioMovimiento.toLocaleString()}`);
    console.log('');
    console.log('💰 Costos por semana:');
    Object.entries(costosPorSemana).forEach(([semana, costo]) => {
      console.log(`   - Semana ${semana}: $${costo.toLocaleString()}`);
    });

    const totales = {
      totalRegistros: registrosProcesados,
      totalGeneral,
      promedioMovimiento,
      semanasUnicas: Object.keys(costosPorSemana).length,
      registrosConSemana
    };

    return NextResponse.json({ 
      records, 
      costosPorSemana,
      totales,
      mesConsultado: mesAnterior,
      success: true 
    });

  } catch (error) {
    console.error('❌ Error en API facturacion-egresos-pirolisis:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos de facturación egresos' },
      { status: 500 }
    );
  }
}