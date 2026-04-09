import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { CAJA_MENOR_FIELDS, ITEMS_CAJA_MENOR_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const CAJA_MENOR_TABLE_ID = process.env.CAJA_MENOR_TABLE_ID || '';
const ITEMS_CAJA_MENOR_TABLE_ID = process.env.ITEMS_CAJA_MENOR_TABLE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

interface CajaMenorAnalysis {
  resumen: {
    totalCajasMenores: number;
    cajasActivas: number;
    cajasConsolidadas: number;
    totalIngresos: number;
    totalEgresos: number;
    saldoActual: number;
  };
  cajasMenores: Array<{
    id: string;
    fechaAnticipo: string;
    beneficiario: string;
    concepto: string;
    valor: number;
    estado: string;
    fechaConsolidacion?: string;
    itemsCount: number;
    totalGastado: number;
    saldoRestante: number;
  }>;
  ultimosMovimientos: Array<{
    fecha: string;
    tipo: 'anticipo' | 'gasto';
    beneficiario: string;
    concepto: string;
    valor: number;
    cajaMenorId: string;
  }>;
  alertas: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !CAJA_MENOR_TABLE_ID || !ITEMS_CAJA_MENOR_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'completo'; // 'completo', 'resumen', 'alertas'

    // Obtener datos de Caja Menor
    const cajaMenorRecords: any[] = [];
    await base(CAJA_MENOR_TABLE_ID).select({
      maxRecords: 100,
      sort: [{ field: CAJA_MENOR_FIELDS.FECHA_ANTICIPO, direction: 'desc' }]
    }).eachPage((records, fetchNextPage) => {
      records.forEach(record => {
        cajaMenorRecords.push({
          id: record.id,
          fechaAnticipo: record.fields[CAJA_MENOR_FIELDS.FECHA_ANTICIPO],
          beneficiario: record.fields[CAJA_MENOR_FIELDS.BENEFICIARIO],
          nitCC: record.fields['Nit-CC'],
          concepto: record.fields[CAJA_MENOR_FIELDS.CONCEPTO],
          valor: record.fields[CAJA_MENOR_FIELDS.VALOR],
          itemsCajaMenor: record.fields[CAJA_MENOR_FIELDS.ITEMS_CAJA_MENOR],
          realizaRegistro: record.fields[CAJA_MENOR_FIELDS.REALIZA_REGISTRO],
          fechaConsolidacion: record.fields[CAJA_MENOR_FIELDS.FECHA_CONSOLIDACION],
          documentoConsolidacion: record.fields[CAJA_MENOR_FIELDS.DOCUMENTO_CONSOLIDACION],
          estadoCajaMenor: record.fields[CAJA_MENOR_FIELDS.ESTADO_CAJA_MENOR]
        });
      });
      fetchNextPage();
    });

    // Obtener items de Caja Menor
    const itemsRecords: any[] = [];
    await base(ITEMS_CAJA_MENOR_TABLE_ID).select({
      maxRecords: 1000,
      sort: [{ field: ITEMS_CAJA_MENOR_FIELDS.FECHA, direction: 'desc' }]
    }).eachPage((records, fetchNextPage) => {
      records.forEach(record => {
        itemsRecords.push({
          id: record.id,
          item: record.fields[ITEMS_CAJA_MENOR_FIELDS.ITEM],
          fecha: record.fields[ITEMS_CAJA_MENOR_FIELDS.FECHA],
          beneficiario: record.fields[ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO],
          nitCC: record.fields['Nit/CC'],
          concepto: record.fields[ITEMS_CAJA_MENOR_FIELDS.CONCEPTO],
          centroCosto: record.fields[ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO],
          valor: record.fields[ITEMS_CAJA_MENOR_FIELDS.VALOR],
          realizaRegistro: record.fields[ITEMS_CAJA_MENOR_FIELDS.REALIZA_REGISTRO],
          cajaMenor: record.fields[ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR],
          comprobante: record.fields[ITEMS_CAJA_MENOR_FIELDS.COMPROBANTE]
        });
      });
      fetchNextPage();
    });

    // Procesar datos para análisis
    const analysis: CajaMenorAnalysis = {
      resumen: {
        totalCajasMenores: cajaMenorRecords.length,
        cajasActivas: cajaMenorRecords.filter(c => !c.fechaConsolidacion).length,
        cajasConsolidadas: cajaMenorRecords.filter(c => c.fechaConsolidacion).length,
        totalIngresos: cajaMenorRecords.reduce((sum, c) => sum + (c.valor || 0), 0),
        totalEgresos: itemsRecords.reduce((sum, item) => sum + (item.valor || 0), 0),
        saldoActual: 0
      },
      cajasMenores: [],
      ultimosMovimientos: [],
      alertas: []
    };

    // Calcular saldo actual
    analysis.resumen.saldoActual = analysis.resumen.totalIngresos - analysis.resumen.totalEgresos;

    // Procesar cajas menores con detalles
    analysis.cajasMenores = cajaMenorRecords.map(caja => {
      const itemsDeEstaCaja = itemsRecords.filter(item =>
        item.cajaMenor && item.cajaMenor.includes(caja.id)
      );

      const totalGastado = itemsDeEstaCaja.reduce((sum, item) => sum + (item.valor || 0), 0);
      const saldoRestante = (caja.valor || 0) - totalGastado;

      return {
        id: caja.id,
        fechaAnticipo: caja.fechaAnticipo,
        beneficiario: caja.beneficiario,
        concepto: caja.concepto,
        valor: caja.valor || 0,
        estado: caja.estadoCajaMenor || (caja.fechaConsolidacion ? 'Consolidada' : 'Abierta'),
        fechaConsolidacion: caja.fechaConsolidacion,
        itemsCount: itemsDeEstaCaja.length,
        totalGastado,
        saldoRestante
      };
    });

    // Obtener últimos movimientos (últimos 20)
    const ultimosMovimientos = [
      // Anticipos
      ...cajaMenorRecords.slice(0, 10).map(caja => ({
        fecha: caja.fechaAnticipo,
        tipo: 'anticipo' as const,
        beneficiario: caja.beneficiario,
        concepto: caja.concepto,
        valor: caja.valor || 0,
        cajaMenorId: caja.id
      })),
      // Gastos
      ...itemsRecords.slice(0, 10).map(item => ({
        fecha: item.fecha,
        tipo: 'gasto' as const,
        beneficiario: item.beneficiario,
        concepto: item.concepto,
        valor: item.valor || 0,
        cajaMenorId: item.cajaMenor ? item.cajaMenor[0] : ''
      }))
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 20);

    analysis.ultimosMovimientos = ultimosMovimientos;

    // Generar alertas
    const alertas: string[] = [];

    // Alertas de saldos bajos
    const cajasConSaldoBajo = analysis.cajasMenores.filter(caja =>
      caja.estado === 'Abierta' && caja.saldoRestante < (caja.valor * 0.1) // Menos del 10%
    );
    cajasConSaldoBajo.forEach(caja => {
      alertas.push(`⚠️ Caja menor de ${caja.beneficiario} tiene solo $${caja.saldoRestante.toLocaleString('es-CO')} restantes (${((caja.saldoRestante / caja.valor) * 100).toFixed(1)}% del total)`);
    });

    // Alertas de cajas sin movimientos recientes
    const fechaHace30Dias = new Date();
    fechaHace30Dias.setDate(fechaHace30Dias.getDate() - 30);

    const cajasSinMovimientos = analysis.cajasMenores.filter(caja => {
      const ultimoMovimiento = ultimosMovimientos.find(m => m.cajaMenorId === caja.id);
      return ultimoMovimiento && new Date(ultimoMovimiento.fecha) < fechaHace30Dias;
    });

    cajasSinMovimientos.forEach(caja => {
      alertas.push(`📅 Caja menor de ${caja.beneficiario} no tiene movimientos desde hace más de 30 días`);
    });

    // Alertas de fin de mes
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    if (hoy.getDate() >= ultimoDiaMes - 3) { // Últimos 3 días del mes
      const cajasSinConsolidar = analysis.cajasMenores.filter(caja =>
        caja.estado === 'Abierta' && !caja.fechaConsolidacion
      );
      if (cajasSinConsolidar.length > 0) {
        alertas.push(`📋 Fin de mes approaching: ${cajasSinConsolidar.length} caja(s) menor(es) pendiente(s) de consolidación`);
      }
    }

    analysis.alertas = alertas;

    // Responder según el tipo solicitado
    switch (tipo) {
      case 'resumen':
        return NextResponse.json({
          success: true,
          data: analysis.resumen
        });

      case 'alertas':
        return NextResponse.json({
          success: true,
          data: { alertas: analysis.alertas }
        });

      case 'completo':
      default:
        return NextResponse.json({
          success: true,
          data: analysis
        });
    }

  } catch (error) {
    console.error('Error en análisis de caja menor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', success: false },
      { status: 500 }
    );
  }
}