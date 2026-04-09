import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';
import { CENTRALIZACION_FIELDS } from '@/lib/config/airtable-fields';

const CENTRALIZACION_TABLE_ID = process.env.AIRTABLE_CENTRALIZACION_TABLE_ID;
const SEMANA_FIELD_ID = process.env.AIRTABLE_CENTRALIZACION_SEMANA_FIELD_ID;
const CALCULO_FIELD_ID = process.env.AIRTABLE_CENTRALIZACION_CALCULO_FIELD_ID;

export async function GET(request: NextRequest) {
  try {
    // Validar variables de entorno requeridas
    if (!CENTRALIZACION_TABLE_ID || !SEMANA_FIELD_ID || !CALCULO_FIELD_ID) {
      console.error('❌ Faltan variables de entorno requeridas para centralizacion-general');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
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
      filters.push(`{${CENTRALIZACION_FIELDS.ANO_FORMULADO}} = ${año}`);
    }
    if (mes) {
      filters.push(`{${CENTRALIZACION_FIELDS.NUMERO_MES}} = ${mes}`);
    }
    
    // Si mode es 'triple' y hay una semana, traer semana-1, semana, semana+1
    if (mode === 'triple' && semana) {
      const semanaNum = parseInt(semana);
      const semanas = [semanaNum - 1, semanaNum, semanaNum + 1].filter(s => s > 0 && s <= 53);
      filters.push(`OR(${semanas.map(s => `{${CENTRALIZACION_FIELDS.SEMANA_FORMULADA}} = ${s}`).join(', ')})`);
    } else if (semana) {
      filters.push(`{${CENTRALIZACION_FIELDS.SEMANA_FORMULADA}} = ${semana}`);
    }

    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
    }

    const records = await base(CENTRALIZACION_TABLE_ID)
      .select({
        filterByFormula: filterFormula || undefined,
        sort: [{ field: SEMANA_FIELD_ID, direction: 'asc' }], // Ordenar por Semana formulada
      })
      .all();

    const data = records.map((record) => ({
      id: record.id,
      fechaCreacion: record.get(CENTRALIZACION_FIELDS.FECHA_CREACION),
      año: record.get(CENTRALIZACION_FIELDS.ANO_FORMULADO),
      mes: record.get(CENTRALIZACION_FIELDS.MES),
      numeroMes: record.get(CENTRALIZACION_FIELDS.NUMERO_MES),
      semana: record.get(CENTRALIZACION_FIELDS.SEMANA_FORMULADA),
      
      // Productos UNB
      unb_purpureocillium: record.get(CENTRALIZACION_FIELDS.UNB_PURPUREOCILLIUM) || 0,
      unb_metarhizium: record.get(CENTRALIZACION_FIELDS.UNB_METARHIZIUM) || 0,
      unb_bacillus: record.get(CENTRALIZACION_FIELDS.UNB_BACILLUS) || 0,
      unb_siriusbacter: record.get(CENTRALIZACION_FIELDS.UNB_SIRIUSBACTER) || 0,
      unb_beauveria: record.get(CENTRALIZACION_FIELDS.UNB_BEAUVERIA) || 0,
      unb_trichoderma: record.get(CENTRALIZACION_FIELDS.UNB_TRICHODERMA) || 0,
      totalUNB: record.get(CENTRALIZACION_FIELDS.TOTAL_UNB) || 0,
      
      // Productos UNP
      unp_biocharPuro: record.get(CENTRALIZACION_FIELDS.UNP_BIOCHAR_PURO) || 0,
      unp_biocharFiltro: record.get(CENTRALIZACION_FIELDS.UNP_BIOCHAR_FILTRO) || 0,
      unp_biocharInoculado: record.get(CENTRALIZACION_FIELDS.UNP_BIOCHAR_INOCULADO) || 0,
      unp_biocharBlend: record.get(CENTRALIZACION_FIELDS.UNP_BIOCHAR_BLEND) || 0,
      totalUNP: record.get(CENTRALIZACION_FIELDS.TOTAL_UNP) || 0,
      
      // Ingresos
      ingresosTotalesUNB: record.get(CENTRALIZACION_FIELDS.INGRESOS_TOTALES_UNB) || 0,
      ingresosTotalesUNP: record.get(CENTRALIZACION_FIELDS.INGRESOS_TOTALES_UNP) || 0,
      ingresosOperacionales: record.get(CENTRALIZACION_FIELDS.INGRESOS_OPERACIONALES) || 0,
      ingresosNoOperacionales: record.get(CENTRALIZACION_FIELDS.INGRESOS_NO_OPERACIONALES) || 0,
      totalIngresos: record.get(CENTRALIZACION_FIELDS.TOTAL_INGRESOS) || 0,
      ingresosEstimados: record.get(CENTRALIZACION_FIELDS.INGRESOS_ESTIMADOS) || 0,
      
      // Egresos
      movimientoCostos: record.get(CENTRALIZACION_FIELDS.MOVIMIENTO_COSTOS) || 0,
      movimientoGastos: record.get(CENTRALIZACION_FIELDS.MOVIMIENTO_GASTOS) || 0,
      movimientoInversion: record.get(CENTRALIZACION_FIELDS.MOVIMIENTO_INVERSION) || 0,
      totalEgresos: record.get(CENTRALIZACION_FIELDS.TOTAL_EGRESOS) || 0,
      egresosEstimados: record.get(CENTRALIZACION_FIELDS.EGRESOS_ESTIMADOS) || 0,
      totalCostosGastosPirolisis: record.get(CENTRALIZACION_FIELDS.TOTAL_COSTOS_GASTOS_PIROLISIS) || 0,
      
      // Saldos Bancarios
      saldoInicialBancos: record.get(CENTRALIZACION_FIELDS.SALDO_INICIAL_BANCOS) || 0,
      saldoFinalBancos: record.get(CENTRALIZACION_FIELDS.SALDO_FINAL_BANCOS) || 0,
      netoSemanalBancos: record.get(CENTRALIZACION_FIELDS.NETO_SEMANAL_BANCOS) || 0,
      
      // Saldos Proyectados
      saldoInicioProyectado: record.get(CENTRALIZACION_FIELDS.SALDO_INICIO_PROYECTADO) || 0,
      saldoFinalProyectado: record.get(CENTRALIZACION_FIELDS.SALDO_FINAL_PROYECTADO) || 0,
      netoSemanalProyectado: record.get(CENTRALIZACION_FIELDS.NETO_SEMANAL_PROYECTADO) || 0,
      
      // Metas de ventas
      cantidadLitrosDeberia: record.get(CENTRALIZACION_FIELDS.CANT_LITROS_DEBERIA) || 0,
      cantidadKilogramosDeberia: record.get(CENTRALIZACION_FIELDS.CANT_KG_DEBERIA) || 0,
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
