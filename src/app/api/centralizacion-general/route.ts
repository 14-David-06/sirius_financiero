import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';

const CENTRALIZACION_TABLE_ID = process.env.AIRTABLE_CENTRALIZACION_TABLE_ID || '';

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!CENTRALIZACION_TABLE_ID) {
      console.error('❌ Falta la variable de entorno AIRTABLE_CENTRALIZACION_TABLE_ID');
      return NextResponse.json(
        { success: false, error: 'Configuración incompleta del servidor' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const año = searchParams.get('año');
    const mes = searchParams.get('mes');
    const semana = searchParams.get('semana');
    const mode = searchParams.get('mode'); // 'triple' para semana pasada, actual y futura

    // Construir filtro según parámetros
    let filterFormula = '';
    const filters: string[] = [];

    if (año) {
      filters.push(`{Año formulado} = ${año}`);
    }
    if (mes) {
      filters.push(`{Numero Mes} = ${mes}`);
    }
    
    // Si mode es 'triple' y hay una semana, traer semana-1, semana, semana+1
    if (mode === 'triple' && semana) {
      const semanaNum = parseInt(semana);
      const semanas = [semanaNum - 1, semanaNum, semanaNum + 1].filter(s => s > 0 && s <= 53);
      filters.push(`OR(${semanas.map(s => `{Semana formulada} = ${s}`).join(', ')})`);
    } else if (semana) {
      filters.push(`{Semana formulada} = ${semana}`);
    }

    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
    }

    const records = await base(CENTRALIZACION_TABLE_ID)
      .select({
        filterByFormula: filterFormula || undefined,
        sort: [{ field: 'fld3mdBlINk32bFsf', direction: 'asc' }], // Ordenar por Semana formulada
      })
      .all();

    const data = records.map((record) => ({
      id: record.id,
      fechaCreacion: record.get('Fecha de creacion'),
      año: record.get('Año formulado'),
      mes: record.get('Mes'),
      numeroMes: record.get('Numero Mes'),
      semana: record.get('Semana formulada'),
      
      // Productos UNB
      unb_purpureocillium: record.get('UNB Purpureocillium Lilacinum') || 0,
      unb_metarhizium: record.get('UNB Metarhizium Anisopliae') || 0,
      unb_bacillus: record.get('UNB Bacillus Thuringiensis') || 0,
      unb_siriusbacter: record.get('UNB SiriusBacter') || 0,
      unb_beauveria: record.get('UNB Beauveria Bassiana') || 0,
      unb_trichoderma: record.get('UNB Trichoderma Harzianum') || 0,
      totalUNB: record.get('Total UNB') || 0,
      
      // Productos UNP
      unp_biocharPuro: record.get('UNP Biochar Puro') || 0,
      unp_biocharFiltro: record.get('UNP Biochar Filtro') || 0,
      unp_biocharInoculado: record.get('UNP Biochar Inoculado') || 0,
      unp_biocharBlend: record.get('UNP Biochar Blend') || 0,
      totalUNP: record.get('Total UNP') || 0,
      
      // Ingresos
      ingresosTotalesUNB: record.get('Ingresos Totales UNB') || 0,
      ingresosTotalesUNP: record.get('Ingresos Totales UNP') || 0,
      ingresosOperacionales: record.get('Ingresos Operacionales') || 0,
      ingresosNoOperacionales: record.get('Ingresos No Operacionales') || 0,
      totalIngresos: record.get('Total Ingresos') || 0,
      ingresosEstimados: record.get('Ingresos Estimados') || 0,
      
      // Egresos
      movimientoCostos: record.get('Movimiento Costos') || 0,
      movimientoGastos: record.get('Movimiento Gastos') || 0,
      movimientoInversion: record.get('Movimiento Inversion') || 0,
      totalEgresos: record.get('Total Egresos') || 0,
      egresosEstimados: record.get('Cálculo') || 0, // Campo fld3lRFUDKNyV3iHK
      totalCostosGastosPirolisis: record.get('Total Costos Gastos Pirolisis') || 0,
      
      // Saldos Bancarios
      saldoInicialBancos: record.get('Saldo Inicial Semana/Bancos') || 0,
      saldoFinalBancos: record.get('Saldo Final Semana/Bancos') || 0,
      netoSemanalBancos: record.get('Neto Semanal/Bancos') || 0,
      
      // Saldos Proyectados
      saldoInicioProyectado: record.get('Saldo Inicio Semana/Proyectado') || 0,
      saldoFinalProyectado: record.get('fld8ma9lWVBPZS87o') || 0, // Saldo Final Semana/Proyectado
      netoSemanalProyectado: record.get('Neto Semanal/Proyectado') || 0,
      
      // Metas de ventas
      cantidadLitrosDeberia: record.get('Cantidad Litros Deberia Vender (Biologicos)') || 0,
      cantidadKilogramosDeberia: record.get('Cantidad Kilogramos Deberia Vender (Biochar)') || 0,
    }));

    return NextResponse.json({ 
      success: true, 
      data,
      total: data.length 
    });

  } catch (error) {
    console.error('Error fetching centralizacion data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos de centralización' },
      { status: 500 }
    );
  }
}
