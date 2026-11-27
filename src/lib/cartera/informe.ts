import {
  ALCANCES_INFORME,
  clientesDelAlcance,
  cumpleAlcance,
  RANGOS_ANTIGUEDAD,
  type AlcanceInforme,
  type FacturaAnalizada,
} from './analisis';

export async function descargarInformePdf(alcance: AlcanceInforme) {
  const respuesta = await fetch(`/api/cartera/informe-pdf?alcance=${alcance}`, { cache: 'no-store' });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(cuerpo?.error || `Error ${respuesta.status}`);
  }
  const nombre =
    respuesta.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `informe-cartera-${alcance}.pdf`;
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

const FORMATO_PESOS = '"$"#,##0';
const aFecha = (iso: string | null) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

export async function descargarInformeCartera(facturas: FacturaAnalizada[], hoy: string, alcance: AlcanceInforme) {
  const XLSX = await import('xlsx');
  const titulo = ALCANCES_INFORME.find(a => a.id === alcance)!.titulo;
  const seleccion = facturas.filter(f => cumpleAlcance(f, alcance));
  const clientes = clientesDelAlcance(facturas, alcance);
  const generado = `Generado el ${new Date(`${hoy}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const formatear = (hoja: import('xlsx').WorkSheet, filaInicio: number, columnasPesos: number[], anchos: number[]) => {
    const rango = XLSX.utils.decode_range(hoja['!ref']!);
    for (let r = filaInicio; r <= rango.e.r; r++) {
      for (const c of columnasPesos) {
        const celda = hoja[XLSX.utils.encode_cell({ r, c })];
        if (celda && celda.t === 'n') celda.z = FORMATO_PESOS;
      }
    }
    hoja['!cols'] = anchos.map(wch => ({ wch }));
    hoja['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: anchos.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: anchos.length - 1 } },
    ];
  };

  const encabezadoClientes = [
    'Cliente',
    'NIT',
    'Facturas pendientes',
    'Saldo pendiente',
    ...RANGOS_ANTIGUEDAD.map(r => r.etiqueta),
    'Días máx. vencida',
    'Último pago',
  ];
  const filasClientes = clientes.map(c => [
    c.cliente,
    c.nit,
    c.facturasPendientes,
    Math.round(c.saldo),
    ...RANGOS_ANTIGUEDAD.map(r => Math.round(c.porRango[r.id])),
    c.diasMaxVencida || '',
    aFecha(c.ultimoPago),
  ]);
  const totalClientes = [
    'TOTAL',
    '',
    seleccion.length,
    Math.round(clientes.reduce((s, c) => s + c.saldo, 0)),
    ...RANGOS_ANTIGUEDAD.map(r => Math.round(clientes.reduce((s, c) => s + c.porRango[r.id], 0))),
    '',
    '',
  ];
  const hojaClientes = XLSX.utils.aoa_to_sheet(
    [[`Informe de cartera por cliente · ${titulo}`], [generado], [], encabezadoClientes, ...filasClientes, totalClientes],
    { cellDates: true, dateNF: 'dd/mm/yyyy' }
  );
  formatear(hojaClientes, 4, [3, 4, 5, 6, 7, 8, 9], [44, 16, 12, 16, 14, 14, 14, 14, 14, 14, 12, 13]);

  const orden = new Map(clientes.map((c, i) => [c.clave, i]));
  const filasFacturas = [...seleccion]
    .sort(
      (a, b) =>
        (orden.get(a.clienteNIT || a.cliente.toUpperCase()) ?? 0) -
          (orden.get(b.clienteNIT || b.cliente.toUpperCase()) ?? 0) || b.diasVencida - a.diasVencida
    )
    .map(f => [
      f.cliente,
      f.clienteNIT,
      f.facturaNo,
      aFecha(f.fechaEmision),
      aFecha(f.fechaVencimiento),
      f.vencida ? f.diasVencida : 0,
      Math.round(f.totalFactura),
      Math.round(f.pagado),
      Math.round(f.saldoPendiente),
      f.estadoFactura,
      f.porConciliar ? 'Pago bancario recibido, pendiente por conciliar' : '',
    ]);
  const hojaFacturas = XLSX.utils.aoa_to_sheet(
    [
      [`Detalle de facturas · ${titulo}`],
      [generado],
      [],
      ['Cliente', 'NIT', 'Factura', 'Emisión', 'Vencimiento', 'Días vencida', 'Total factura', 'Pagado', 'Saldo pendiente', 'Estado', 'Observación'],
      ...filasFacturas,
    ],
    { cellDates: true, dateNF: 'dd/mm/yyyy' }
  );
  formatear(hojaFacturas, 4, [6, 7, 8], [44, 16, 12, 12, 12, 12, 15, 15, 15, 11, 42]);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaClientes, 'Clientes');
  XLSX.utils.book_append_sheet(libro, hojaFacturas, 'Facturas');
  XLSX.writeFile(libro, `informe-cartera-${alcance}-${hoy}.xlsx`);

  return { clientes: clientes.length, facturas: seleccion.length };
}
