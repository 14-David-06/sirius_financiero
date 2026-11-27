import { CircleCheck, Clock, Landmark, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Monto, ResumenCartera } from '@/lib/cartera/analisis';
import { formatoCOP, formatoCOPCorto, formatoPorcentaje } from '@/lib/cartera/formato';
import { COLORES, ESTADO_SEMAFORO, TARJETA, plural } from './estilos';

function Indicador({
  icono: Icono,
  color,
  titulo,
  valor,
  detalle,
}: {
  icono: LucideIcon;
  color: string;
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div className={`${TARJETA} flex flex-col p-5`}>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Icono className="h-4 w-4 shrink-0" style={{ color }} aria-hidden="true" />
        {titulo}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-50">{valor}</p>
      <p className="mt-1 text-xs text-slate-400">{detalle}</p>
    </div>
  );
}

function ParteLeyenda({ color, nombre, monto }: { color: string; nombre: string; monto: Monto }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-slate-400">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
        {nombre}
      </dt>
      <dd className="mt-1 font-semibold text-slate-100">
        {formatoCOPCorto(monto.monto)}{' '}
        <span className="font-normal text-slate-400">· {plural(monto.facturas, 'factura', 'facturas')}</span>
      </dd>
    </div>
  );
}

export default function IndicadoresCartera({ resumen }: { resumen: ResumenCartera }) {
  const { saldo, vencida, porVencer, mas90, porConciliar, diasCobro } = resumen;
  const porcentajeVencida = saldo > 0 ? (vencida.monto / saldo) * 100 : 0;
  const recaudo = Math.min(100, resumen.porcentajeRecaudado);

  return (
    <section aria-label="Indicadores de cartera" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={`${TARJETA} flex flex-col p-6 sm:col-span-2 lg:row-span-2`}>
        <p className="text-sm text-slate-300">Cartera por cobrar</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight text-slate-50">{formatoCOPCorto(saldo)}</p>
        <p className="mt-2 text-sm text-slate-400">
          {formatoCOP(saldo)} · {plural(resumen.facturasPendientes, 'factura', 'facturas')} ·{' '}
          {plural(resumen.clientesConSaldo, 'cliente', 'clientes')}
        </p>

        {saldo > 0 && (
          <div className="mt-6">
            <div
              className="flex h-2 w-full gap-0.5"
              role="img"
              aria-label={`Vencida ${formatoCOP(vencida.monto)}; por vencer ${formatoCOP(porVencer.monto)}`}
            >
              {vencida.monto > 0 && (
                <span
                  className="h-full rounded-full"
                  style={{ flex: `${vencida.monto} 1 0`, backgroundColor: COLORES.vencida }}
                />
              )}
              {porVencer.monto > 0 && (
                <span
                  className="h-full rounded-full"
                  style={{ flex: `${porVencer.monto} 1 0`, backgroundColor: COLORES.porVencer }}
                />
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <ParteLeyenda color={COLORES.vencida} nombre="Vencida" monto={vencida} />
              <ParteLeyenda color={COLORES.porVencer} nombre="Por vencer" monto={porVencer} />
            </dl>
          </div>
        )}

        <div className="mt-auto pt-6">
          <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-5 text-sm">
            <span className="text-slate-300">Recaudado del total facturado</span>
            <span className="font-semibold text-slate-50">{formatoPorcentaje(resumen.porcentajeRecaudado)}</span>
          </div>
          <div
            className="mt-2 h-2 w-full rounded-full"
            style={{ backgroundColor: `${COLORES.recaudado}33` }}
            role="meter"
            aria-label="Porcentaje recaudado del total facturado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(recaudo)}
          >
            <div className="h-full rounded-full" style={{ width: `${recaudo}%`, backgroundColor: COLORES.recaudado }} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {formatoCOPCorto(resumen.recaudado)} recaudados de {formatoCOPCorto(resumen.facturado)} facturados
          </p>
        </div>
      </div>

      <Indicador
        icono={TriangleAlert}
        color={ESTADO_SEMAFORO.serio}
        titulo="Cartera vencida"
        valor={formatoCOPCorto(vencida.monto)}
        detalle={`${plural(vencida.facturas, 'factura', 'facturas')} · ${formatoPorcentaje(porcentajeVencida)} del saldo`}
      />
      <Indicador
        icono={OctagonAlert}
        color={ESTADO_SEMAFORO.critico}
        titulo="Vencida más de 90 días"
        valor={formatoCOPCorto(mas90.monto)}
        detalle={plural(mas90.facturas, 'factura', 'facturas')}
      />
      <Indicador
        icono={Clock}
        color={COLORES.textoSecundario}
        titulo="Tiempo de cobro"
        valor={diasCobro ? `${diasCobro.mediana} días` : '—'}
        detalle={
          diasCobro
            ? `Mediana entre emisión y pago · ${plural(diasCobro.muestras, 'factura pagada', 'facturas pagadas')} en 6 meses`
            : 'Sin pagos en los últimos 6 meses'
        }
      />
      {porConciliar.facturas > 0 ? (
        <Indicador
          icono={Landmark}
          color={ESTADO_SEMAFORO.alerta}
          titulo="Pagos por conciliar"
          valor={formatoCOPCorto(porConciliar.monto)}
          detalle={`${plural(porConciliar.facturas, 'factura tiene', 'facturas tienen')} pago bancario sin aplicar`}
        />
      ) : (
        <Indicador
          icono={CircleCheck}
          color={ESTADO_SEMAFORO.bien}
          titulo="Pagos por conciliar"
          valor="Al día"
          detalle="Todos los pagos recibidos están aplicados"
        />
      )}
    </section>
  );
}
