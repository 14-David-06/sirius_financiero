import {
  ALCANCES_INFORME,
  clientesDelAlcance,
  cumpleAlcance,
  RANGOS_ANTIGUEDAD,
  type AlcanceInforme,
  type FacturaAnalizada,
  type RangoAntiguedad,
} from './analisis';
import { formatoCOP, formatoFecha, formatoPorcentaje } from './formato';
import type { EstadoFactura } from '@/types/cartera';

const COLOR = {
  porVencer: '#257de0',
  vencida: '#f47230',
  tinta: '#191919',
  tintaSecundaria: '#666666',
  grilla: '#e7e7e7',
  eje: '#c2c2c2',
};

const COLOR_ESTADO: Record<EstadoFactura, string> = {
  Pagada: '#0aac23',
  Parcial: '#fbb315',
  Pendiente: '#f18a59',
  'Sin Pagar': '#dc3c3d',
};

const esc = (texto: string) =>
  texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

export function fechaLarga(fechaISO: string): string {
  return new Date(`${fechaISO}T12:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function punto(color: string) {
  return `<span class="punto" style="background:${color}"></span>`;
}

function mora(f: FacturaAnalizada) {
  return f.vencida ? `${punto(COLOR.vencida)}${f.diasVencida}` : `${punto(COLOR.porVencer)}Vence en ${-f.diasVencida}`;
}

export function htmlInformeCartera({
  facturas,
  alcance,
  hoy,
  logoBase64,
}: {
  facturas: FacturaAnalizada[];
  alcance: AlcanceInforme;
  hoy: string;
  logoBase64: string | null;
}): string {
  const { titulo } = ALCANCES_INFORME.find(a => a.id === alcance)!;
  const seleccion = facturas.filter(f => cumpleAlcance(f, alcance));
  const clientes = clientesDelAlcance(facturas, alcance);

  const saldo = seleccion.reduce((s, f) => s + f.saldoPendiente, 0);
  const vencidas = seleccion.filter(f => f.vencida);
  const vencida = vencidas.reduce((s, f) => s + f.saldoPendiente, 0);
  const mas90 = seleccion.filter(f => f.diasVencida > 90);
  const porConciliar = seleccion.filter(f => f.porConciliar);
  const porRango = (id: RangoAntiguedad) => seleccion.filter(f => f.rango === id);

  const kpi = (etiqueta: string, valor: string, detalle: string) =>
    `<div class="kpi"><div class="etq">${etiqueta}</div><div class="val">${valor}</div><div class="det">${detalle}</div></div>`;

  const antiguedad = RANGOS_ANTIGUEDAD.map(r => {
    const del = porRango(r.id);
    const monto = del.reduce((s, f) => s + f.saldoPendiente, 0);
    return { ...r, monto, facturas: del.length };
  });

  const filasClientes = clientes
    .map(
      (c, i) => `<tr>
        <td class="num gris">${i + 1}</td>
        <td><div class="nombre">${esc(c.cliente)}</div><div class="gris">${c.nit ? `NIT ${esc(c.nit)}` : 'Sin NIT'}</div></td>
        <td class="num">${c.facturasPendientes}</td>
        <td class="num fuerte">${formatoCOP(c.saldo)}</td>
        ${RANGOS_ANTIGUEDAD.map(r => `<td class="num">${c.porRango[r.id] > 0 ? formatoCOP(c.porRango[r.id]) : '<span class="gris">—</span>'}</td>`).join('')}
        <td class="num">${c.diasMaxVencida > 0 ? c.diasMaxVencida : '<span class="gris">—</span>'}</td>
        <td class="num">${formatoFecha(c.ultimoPago)}</td>
      </tr>`
    )
    .join('');

  const totalPorRango = (id: RangoAntiguedad) => clientes.reduce((s, c) => s + c.porRango[id], 0);

  const detalle = clientes
    .map(c => {
      const suyas = seleccion
        .filter(f => (f.clienteNIT || f.cliente.toUpperCase()) === c.clave)
        .sort((a, b) => b.diasVencida - a.diasVencida);
      const totales = suyas.reduce(
        (t, f) => ({ total: t.total + f.totalFactura, pagado: t.pagado + f.pagado }),
        { total: 0, pagado: 0 }
      );
      return `<section class="grupo${suyas.length <= 15 ? ' junto' : ''}">
        <div class="grupo-titulo">
          <span><strong>${esc(c.cliente)}</strong>${c.nit ? ` · NIT ${esc(c.nit)}` : ''}</span>
          <span>Saldo <strong>${formatoCOP(c.saldo)}</strong> · ${plural(suyas.length, 'factura', 'facturas')}${
            c.ultimoPago ? ` · último pago ${formatoFecha(c.ultimoPago)}` : ''
          }</span>
        </div>
        <table class="fija">
          <colgroup>
            <col style="width:9%" /><col style="width:10%" /><col style="width:10%" /><col style="width:10%" />
            <col style="width:13%" /><col style="width:13%" /><col style="width:13%" /><col style="width:22%" />
          </colgroup>
          <thead><tr>
            <th>Factura</th><th>Emisión</th><th>Vencimiento</th><th class="num">Días de mora</th>
            <th class="num">Total factura</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${suyas
              .map(
                f => `<tr>
                <td>${esc(f.facturaNo)}</td>
                <td>${formatoFecha(f.fechaEmision)}</td>
                <td>${formatoFecha(f.fechaVencimiento)}</td>
                <td class="num">${mora(f)}</td>
                <td class="num">${formatoCOP(f.totalFactura)}</td>
                <td class="num">${formatoCOP(f.pagado)}</td>
                <td class="num fuerte">${formatoCOP(f.saldoPendiente)}</td>
                <td>${punto(COLOR_ESTADO[f.estadoFactura])}${f.estadoFactura}${
                  f.porConciliar ? '<div class="gris">Pago recibido, por conciliar</div>' : ''
                }</td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="4">Subtotal</td>
            <td class="num">${formatoCOP(totales.total)}</td>
            <td class="num">${formatoCOP(totales.pagado)}</td>
            <td class="num">${formatoCOP(c.saldo)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </section>`;
    })
    .join('');

  const sinDatos = seleccion.length === 0;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Informe de cartera · ${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif; color: ${COLOR.tinta}; font-size: 8.5pt; line-height: 1.35; }
  .encabezado { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 10px; border-bottom: 1.5px solid ${COLOR.tinta}; }
  .encabezado img { height: 36px; display: block; margin-bottom: 6px; }
  h1 { font-size: 17pt; margin: 0; font-weight: 600; }
  .sub, .gris { color: ${COLOR.tintaSecundaria}; }
  .sub { font-size: 9pt; }
  .derecha { text-align: right; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 14px 0 6px; }
  .kpi { border: 1px solid ${COLOR.grilla}; border-radius: 6px; padding: 8px 10px; }
  .kpi .etq { color: ${COLOR.tintaSecundaria}; font-size: 8pt; }
  .kpi .val { font-size: 14pt; font-weight: 600; margin-top: 2px; }
  .kpi .det { color: ${COLOR.tintaSecundaria}; font-size: 7.5pt; margin-top: 1px; }
  h2 { font-size: 11pt; font-weight: 600; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  table.fija { table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  th { text-align: left; font-weight: 600; font-size: 7.5pt; color: ${COLOR.tintaSecundaria}; padding: 5px 6px; border-bottom: 1px solid ${COLOR.eje}; }
  td { padding: 4px 6px; border-bottom: 1px solid ${COLOR.grilla}; vertical-align: top; }
  tr { break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  .fuerte { font-weight: 600; }
  .nombre { font-weight: 600; }
  tfoot td, tr.total td { font-weight: 600; border-top: 1px solid ${COLOR.eje}; border-bottom: none; }
  .punto { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }
  .barra { display: flex; gap: 2px; height: 8px; margin: 4px 0 8px; }
  .barra span { border-radius: 4px; }
  .leyenda { display: flex; gap: 16px; color: ${COLOR.tintaSecundaria}; font-size: 8pt; }
  .grupo { margin-top: 12px; }
  .grupo.junto { break-inside: avoid; }
  .grupo-titulo { display: flex; justify-content: space-between; gap: 12px; padding: 6px 6px; background: #f4f6f8; border-radius: 4px; font-size: 8.5pt; }
  .nota { margin-top: 16px; padding-top: 8px; border-top: 1px solid ${COLOR.grilla}; color: ${COLOR.tintaSecundaria}; font-size: 7.5pt; }
  .vacio { margin-top: 30px; padding: 24px; text-align: center; border: 1px dashed ${COLOR.eje}; border-radius: 6px; color: ${COLOR.tintaSecundaria}; }
</style></head>
<body>
  <header class="encabezado">
    <div>
      ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Sirius" />` : ''}
      <h1>Informe de cartera</h1>
      <div class="sub">${esc(titulo)} · clientes con pagos pendientes</div>
    </div>
    <div class="derecha sub">
      <div>Fecha de corte: <strong style="color:${COLOR.tinta}">${fechaLarga(hoy)}</strong></div>
      <div>Saldos calculados con la conciliación de pagos bancarios</div>
    </div>
  </header>

  ${
    sinDatos
      ? `<div class="vacio">No hay facturas con saldo pendiente para este alcance.</div>`
      : `
  <div class="kpis">
    ${kpi('Saldo pendiente', formatoCOP(saldo), `${plural(seleccion.length, 'factura', 'facturas')} · ${plural(clientes.length, 'cliente', 'clientes')}`)}
    ${kpi('Cartera vencida', formatoCOP(vencida), `${plural(vencidas.length, 'factura', 'facturas')} · ${formatoPorcentaje(saldo > 0 ? (vencida / saldo) * 100 : 0)} del saldo`)}
    ${kpi('Por vencer', formatoCOP(saldo - vencida), plural(seleccion.length - vencidas.length, 'factura', 'facturas'))}
    ${kpi('Vencida más de 90 días', formatoCOP(mas90.reduce((s, f) => s + f.saldoPendiente, 0)), plural(mas90.length, 'factura', 'facturas'))}
    ${kpi('Pagos por conciliar', formatoCOP(porConciliar.reduce((s, f) => s + f.saldoPendiente, 0)), porConciliar.length ? `${plural(porConciliar.length, 'factura', 'facturas')} con pago recibido sin aplicar` : 'Todos los pagos están aplicados')}
  </div>

  <h2>Antigüedad del saldo</h2>
  <div class="barra">
    ${vencida > 0 ? `<span style="flex:${vencida} 1 0;background:${COLOR.vencida}"></span>` : ''}
    ${saldo - vencida > 0 ? `<span style="flex:${saldo - vencida} 1 0;background:${COLOR.porVencer}"></span>` : ''}
  </div>
  <div class="leyenda"><span>${punto(COLOR.vencida)}Vencida</span><span>${punto(COLOR.porVencer)}Por vencer</span></div>
  <table style="margin-top:6px">
    <thead><tr><th></th>${antiguedad.map(r => `<th class="num">${esc(r.etiqueta)}</th>`).join('')}<th class="num">Total</th></tr></thead>
    <tbody>
      <tr><td class="gris">Saldo</td>${antiguedad.map(r => `<td class="num fuerte">${formatoCOP(r.monto)}</td>`).join('')}<td class="num fuerte">${formatoCOP(saldo)}</td></tr>
      <tr><td class="gris">% del saldo</td>${antiguedad.map(r => `<td class="num">${formatoPorcentaje(saldo > 0 ? (r.monto / saldo) * 100 : 0)}</td>`).join('')}<td class="num">100 %</td></tr>
      <tr><td class="gris">Facturas</td>${antiguedad.map(r => `<td class="num">${r.facturas}</td>`).join('')}<td class="num">${seleccion.length}</td></tr>
    </tbody>
  </table>

  <h2>Resumen por cliente</h2>
  <table>
    <thead><tr>
      <th class="num">#</th><th>Cliente</th><th class="num">Facturas</th><th class="num">Saldo</th>
      ${RANGOS_ANTIGUEDAD.map(r => `<th class="num">${esc(r.id === 'por-vencer' ? 'Por vencer' : r.corta)}</th>`).join('')}
      <th class="num">Mora máx.</th><th class="num">Último pago</th>
    </tr></thead>
    <tbody>${filasClientes}</tbody>
    <tfoot><tr>
      <td></td><td>Total</td><td class="num">${seleccion.length}</td><td class="num">${formatoCOP(saldo)}</td>
      ${RANGOS_ANTIGUEDAD.map(r => `<td class="num">${formatoCOP(totalPorRango(r.id))}</td>`).join('')}
      <td></td><td></td>
    </tr></tfoot>
  </table>

  <h2>Detalle de facturas por cliente</h2>
  ${detalle}

  <p class="nota">
    El saldo de cada factura se calcula con la conciliación en cascada de los movimientos bancarios.
    Días de mora: días transcurridos desde la fecha de vencimiento (o desde la emisión más el plazo cuando no hay vencimiento registrado).
    "Pago recibido, por conciliar" indica que ya hay un movimiento bancario vinculado que aún no se ha aplicado a la factura.
  </p>`
  }
</body></html>`;
}
