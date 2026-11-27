import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { BANCOS, esBancoId, type BancoId } from '@/lib/bancos/cuentas';
import { movimientosDelPeriodo, resumenCuenta } from '@/lib/bancos/movimientos';
import type { PeriodoMovimientos, RespuestaMovimientos, ResumenCuenta } from '@/types/movimientos-bancarios';

export const maxDuration = 60;

function entero(valor: string | null, minimo: number, maximo: number): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  const n = Number(valor);
  return n >= minimo && n <= maximo ? n : null;
}

/**
 * GET ?banco=bancolombia|bbva&anio=2026&mes=11
 * Sin año: el mes del último movimiento registrado de ese banco. Sin mes: todo el año.
 */
export async function GET(request: NextRequest) {
  const usuario = obtenerUsuarioSesion(request);
  if (!usuario) {
    return NextResponse.json({ success: false, error: 'Sesión no válida' }, { status: 401 });
  }
  if (usuario.categoria === 'Colaborador') {
    return NextResponse.json({ success: false, error: 'No tiene permisos para ver los movimientos bancarios' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const banco = searchParams.get('banco');
  if (!esBancoId(banco)) {
    return NextResponse.json({ success: false, error: 'Banco no válido (bancolombia o bbva)' }, { status: 400 });
  }
  const año = entero(searchParams.get('anio'), 2000, 2100);
  const mes = entero(searchParams.get('mes'), 1, 12);

  try {
    const resumenes = await Promise.all(BANCOS.map(resumenCuenta));
    const cuentas = Object.fromEntries(BANCOS.map((id, i) => [id, resumenes[i]])) as Record<BancoId, ResumenCuenta>;

    let periodo: PeriodoMovimientos;
    if (año) {
      periodo = { año, mes };
    } else {
      const ultima = cuentas[banco].fechaUltimoMovimiento;
      const [ultimoAño, ultimoMes] = (ultima ?? new Date().toISOString()).split('-').map(Number);
      periodo = { año: ultimoAño, mes: ultimoMes };
    }

    const movimientos = await movimientosDelPeriodo(banco, periodo);
    const respuesta: RespuestaMovimientos = { success: true, banco, periodo, cuentas, movimientos };
    return NextResponse.json(respuesta);
  } catch (error) {
    console.error(`❌ Error consultando movimientos de ${banco}:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
