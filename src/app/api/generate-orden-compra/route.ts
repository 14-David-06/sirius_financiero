import { NextRequest, NextResponse } from 'next/server';
import { CompraCompleta } from '@/types/compras';
import { OC_FIELDS, ITEMS_OC_FIELDS, COMPRAS_FIELDS } from '@/lib/config/airtable-fields';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;
const COTIZACIONES_TABLE_ID = process.env.AIRTABLE_COTIZACIONES_TABLE_ID;
const ITEMS_COTIZADOS_TABLE_ID = process.env.AIRTABLE_ITEMS_COTIZADOS_TABLE_ID;
const PROVEEDORES_TABLE_ID = process.env.AIRTABLE_PROVEEDORES_TABLE_ID;

// Tipos internos para datos de cotización
interface ItemCotizadoData {
  id: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  valorUnitario: number;
  itemCompraRelacionado?: string[];
}

interface CotizacionCompleta {
  id: string;
  idCotizacion: string;
  fecha: string;
  documentoUrl: string;
  estado: string;
  comentarios: string;
  proveedorIds: string[];
  proveedorNombre: string;
  proveedorNit: string;
  proveedorCiudad: string;
  proveedorDepartamento: string;
  items: ItemCotizadoData[];
}

async function airtableFetch(tableId: string, recordId: string) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
    {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

async function airtableList(tableId: string, filterFormula: string) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`);
  url.searchParams.set('filterByFormula', filterFormula);
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

async function airtableCreate(tableId: string, fields: Record<string, unknown>) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

async function airtableCreateBatch(tableId: string, records: Array<{ fields: Record<string, unknown> }>) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

async function airtableUpdate(tableId: string, recordId: string, fields: Record<string, unknown>) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

// Obtener la cotización vinculada a una compra, con sus items y datos del proveedor
async function fetchCotizacionCompleta(compraId: string): Promise<CotizacionCompleta | null> {
  if (!COTIZACIONES_TABLE_ID || !ITEMS_COTIZADOS_TABLE_ID) return null;

  // 1. Buscar cotización vinculada a esta compra
  const cotResult = await airtableList(
    COTIZACIONES_TABLE_ID,
    `FIND("${compraId}", ARRAYJOIN({Compras y Adquisiciones Relacionada}))`
  );

  if (!cotResult.records?.length) return null;

  // Tomar la cotización más reciente si hay varias
  const cotRecord = cotResult.records[cotResult.records.length - 1];
  const f = cotRecord.fields;

  // 2. Obtener items cotizados vinculados
  const itemIds: string[] = f['Items Cotizados'] || [];
  const items: ItemCotizadoData[] = [];

  for (const itemId of itemIds) {
    const itemRecord = await airtableFetch(ITEMS_COTIZADOS_TABLE_ID, itemId);
    const fi = itemRecord.fields;
    items.push({
      id: itemRecord.id,
      descripcion: fi['Descripción del Item'] || fi['Descripcion del Item'] || '',
      cantidad: fi['Cantidad Cotizada'] || 0,
      unidadMedida: fi['Unidad de Medida'] || '',
      valorUnitario: fi['Valor Unitario Cotizado'] || 0,
      itemCompraRelacionado: fi['Item Compra Relacionado'] || undefined,
    });
  }

  // 3. Obtener datos del proveedor si hay link
  const proveedorIds: string[] = f['Proveedor'] || [];
  let proveedorNombre = '', proveedorNit = '', proveedorCiudad = '', proveedorDepartamento = '';

  if (proveedorIds.length > 0 && PROVEEDORES_TABLE_ID) {
    try {
      const provRecord = await airtableFetch(PROVEEDORES_TABLE_ID, proveedorIds[0]);
      const fp = provRecord.fields;
      proveedorNombre = fp['Nombre'] || '';
      proveedorNit = fp['C.c o Nit'] || '';
      proveedorCiudad = fp['Ciudad'] || '';
      const deptField = fp['Departamento (from Departamento )'];
      proveedorDepartamento = Array.isArray(deptField) ? deptField[0] || '' : deptField || '';
    } catch {
      // Si falla obtener proveedor, continuamos sin datos
    }
  }

  // Documento: puede ser attachment (array) o URL
  let documentoUrl = '';
  const docField = f['Documento Cotización'];
  if (Array.isArray(docField) && docField.length > 0) {
    documentoUrl = docField[0].url || '';
  } else if (typeof docField === 'string') {
    documentoUrl = docField;
  }

  return {
    id: cotRecord.id,
    idCotizacion: f['ID Cotización'] || '',
    fecha: f['Fecha de Cotización'] || '',
    documentoUrl,
    estado: f['Estado de Cotización'] || '',
    comentarios: f['Comentarios'] || '',
    proveedorIds,
    proveedorNombre,
    proveedorNit,
    proveedorCiudad,
    proveedorDepartamento,
    items,
  };
}

async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  if (isProduction) {
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
    });
  } else {
    const executablePath = process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome';
    
    return puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Configuración de Airtable faltante' },
        { status: 500 }
      );
    }

    const data = await request.json();
    
    if (!data.solicitudData || !data.compraId) {
      return NextResponse.json(
        { error: 'Datos de solicitud y compraId son requeridos' },
        { status: 400 }
      );
    }

    const solicitud: CompraCompleta = data.solicitudData;
    const compraId: string = data.compraId;

    // 1. Obtener cotización completa desde Airtable
    const cotizacion = await fetchCotizacionCompleta(compraId);

    if (!cotizacion || cotizacion.items.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró una cotización con items para esta solicitud. Debe cargar una cotización primero.' },
        { status: 400 }
      );
    }

    // 2. Generar HTML del PDF usando datos de cotización
    const htmlContent = generateOrdenCompraHTML(solicitud, cotizacion);

    // 3. Generar PDF
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();

    // 4. Subir PDF a S3
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreLimpio = (solicitud.nombreSolicitante || '')
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, '');
    const fileName = `ordencompra[${nombreLimpio}][${fechaActual}].pdf`;
    const fullPath = `ordenes de compra/${fileName}`;

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fullPath,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
      Metadata: {
        'tipo-documento': 'orden-compra',
        'solicitante': solicitud.nombreSolicitante || '',
        'fecha-generacion': new Date().toISOString(),
      }
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${encodeURIComponent(fullPath)}`;

    // 5. Crear registros en Airtable
    const ocId = `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    let ordenCompraRecordId: string | undefined;
    let itemsCreados = 0;

    if (ORDENES_TABLE_ID && ITEMS_OC_TABLE_ID) {
      const iva = solicitud.iva || 0;
      const retencion = solicitud.retencion || 0;

      // Crear registro de Orden de Compra
      const ocFields: Record<string, unknown> = {
        [OC_FIELDS.ID_ORDEN_COMPRA]: ocId,
        [OC_FIELDS.FECHA_EMISION]: fechaActual,
        [OC_FIELDS.NOMBRE_SOLICITANTE]: solicitud.nombreSolicitante,
        [OC_FIELDS.CARGO_SOLICITANTE]: solicitud.cargoSolicitante,
        [OC_FIELDS.AREA_CORRESPONDIENTE]: solicitud.areaCorrespondiente,
        [OC_FIELDS.ESTADO]: 'Emitida',
        [OC_FIELDS.DOCUMENTO_OC]: fileUrl,
        [OC_FIELDS.IVA]: iva,
        [OC_FIELDS.RETENCION]: retencion,
        // Subtotal es rollup (computado) — no se escribe
        // Total Neto es formula (computado) — no se escribe
        [OC_FIELDS.COMPRA_RELACIONADA]: [compraId],
        [OC_FIELDS.COTIZACION_RELACIONADA]: [cotizacion.id],
      };

      if (cotizacion.proveedorIds.length > 0) {
        ocFields[OC_FIELDS.PROVEEDOR] = cotizacion.proveedorIds;
      }

      if (solicitud.prioridadSolicitud) {
        ocFields[OC_FIELDS.PRIORIDAD] = solicitud.prioridadSolicitud;
      }

      if (solicitud.nombresAdmin) {
        ocFields[OC_FIELDS.AUTORIZADO_POR] = solicitud.nombresAdmin;
      }

      if (solicitud.descripcionIA || solicitud.descripcionSolicitud) {
        ocFields[OC_FIELDS.DESCRIPCION] = solicitud.descripcionIA || solicitud.descripcionSolicitud;
      }

      if (cotizacion.documentoUrl) {
        ocFields[OC_FIELDS.COTIZACION_DOC_URL] = cotizacion.documentoUrl;
      }

      const ocRecord = await airtableCreate(ORDENES_TABLE_ID, ocFields);
      ordenCompraRecordId = ocRecord.id;

      // Crear Items OC desde items cotizados (en lotes de max 10)
      const allItemRecordIds: string[] = [];
      const batches: ItemCotizadoData[][] = [];
      for (let i = 0; i < cotizacion.items.length; i += 10) {
        batches.push(cotizacion.items.slice(i, i + 10));
      }

      for (const batch of batches) {
        const records = batch.map((item, idx) => {
          const itemFields: Record<string, unknown> = {
            [ITEMS_OC_FIELDS.ID_ITEM_OC]: `${ocId}-ITEM-${String(allItemRecordIds.length + idx + 1).padStart(2, '0')}`,
            [ITEMS_OC_FIELDS.ORDEN_COMPRA_RELACIONADA]: [ordenCompraRecordId],
            [ITEMS_OC_FIELDS.DESCRIPCION]: item.descripcion,
            [ITEMS_OC_FIELDS.CANTIDAD]: item.cantidad,
            [ITEMS_OC_FIELDS.VALOR_UNITARIO]: item.valorUnitario,
            // Valor Total Item es fórmula (computado) — no se escribe
          };

          // Link de trazabilidad al item cotizado
          itemFields[ITEMS_OC_FIELDS.ITEM_COTIZADO_RELACIONADO] = [item.id];

          // Link de trazabilidad al item de compra original
          if (item.itemCompraRelacionado?.length) {
            itemFields[ITEMS_OC_FIELDS.ITEM_COMPRA_RELACIONADO] = item.itemCompraRelacionado;
          }

          return { fields: itemFields };
        });

        const batchResult = await airtableCreateBatch(ITEMS_OC_TABLE_ID, records);
        allItemRecordIds.push(...(batchResult.records || []).map((r: { id: string }) => r.id));
      }

      itemsCreados = allItemRecordIds.length;
    }

    // 6. Actualizar Documento Solicitud en la Compra original
    if (COMPRAS_TABLE_ID) {
      await airtableUpdate(COMPRAS_TABLE_ID, compraId, { [COMPRAS_FIELDS.DOCUMENTO_SOLICITUD]: fileUrl });
    }

    return NextResponse.json({
      success: true,
      pdfUrl: fileUrl,
      fileName,
      fullPath,
      ordenCompraId: ocId,
      ordenCompraRecordId,
      itemsCreados,
      cotizacionUsada: cotizacion.idCotizacion,
    });

  } catch (error) {
    console.error('Error generando orden de compra:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generando PDF de orden de compra' },
      { status: 500 }
    );
  }
}

// ============ GENERACIÓN DE HTML PDF ============

function generateOrdenCompraHTML(solicitud: CompraCompleta, cotizacion: CotizacionCompleta): string {
  const fechaActual = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subtotal = cotizacion.items.reduce((total, item) =>
    total + (item.valorUnitario * item.cantidad), 0
  );

  const iva = solicitud.iva || 0;
  const retencion = solicitud.retencion || 0;
  const totalNeto = solicitud.totalNeto || (subtotal + iva - retencion);

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Orden de Compra - ${solicitud.nombreSolicitante}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.5;
          color: #1f2937;
          max-width: 210mm;
          margin: 0 auto;
          padding: 15px;
          background: #fff;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header-left h1 {
          font-size: 22px;
          color: #1e40af;
          margin-bottom: 2px;
        }
        .header-left p {
          font-size: 11px;
          color: #6b7280;
        }
        .header-right {
          text-align: right;
        }
        .header-right .doc-type {
          font-size: 20px;
          font-weight: bold;
          color: #dc2626;
          letter-spacing: 1px;
        }
        .header-right .doc-date {
          font-size: 11px;
          color: #6b7280;
          margin-top: 4px;
        }
        .section {
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        .section-header {
          background: #1e40af;
          color: white;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: bold;
        }
        .section-body {
          padding: 14px;
        }
        .info-row {
          display: flex;
          gap: 20px;
          margin-bottom: 6px;
        }
        .info-item {
          flex: 1;
        }
        .info-label {
          font-weight: bold;
          color: #374151;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-value {
          color: #1f2937;
          font-size: 13px;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        table th {
          background: #1e40af;
          color: white;
          padding: 8px 10px;
          font-size: 11px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }
        table tbody tr:nth-child(even) {
          background: #f9fafb;
        }
        .totals {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }
        .totals-box {
          width: 260px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 14px;
          font-size: 12px;
        }
        .totals-row.total {
          background: #1e40af;
          color: white;
          font-weight: bold;
          font-size: 14px;
          padding: 10px 14px;
        }
        .cotizacion-ref {
          margin-top: 10px;
          padding: 10px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 12px;
        }
        .cotizacion-ref a {
          color: #1e40af;
          text-decoration: none;
          font-weight: bold;
        }
        .signatures {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          gap: 40px;
        }
        .signature-box {
          flex: 1;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #9ca3af;
          margin-top: 50px;
          padding-top: 6px;
          font-size: 11px;
          color: #6b7280;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 10px;
        }
        .priority-alta { color: #dc2626; font-weight: bold; }
        .priority-media { color: #d97706; font-weight: bold; }
        .priority-baja { color: #059669; font-weight: bold; }
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          background: #dcfce7;
          color: #166534;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>SIRIUS FINANCIERO</h1>
          <p>Sistema de Gestión de Compras</p>
        </div>
        <div class="header-right">
          <div class="doc-type">ORDEN DE COMPRA</div>
          <div class="doc-date">${fechaActual}</div>
          ${cotizacion.idCotizacion ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">Ref: ${cotizacion.idCotizacion}</div>` : ''}
          <div style="margin-top:4px;">
            <span class="status-badge">${solicitud.estadoSolicitud || 'Aprobado'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">INFORMACIÓN DEL SOLICITANTE</div>
        <div class="section-body">
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Nombre</div>
              <div class="info-value">${solicitud.nombreSolicitante}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Área</div>
              <div class="info-value">${solicitud.areaCorrespondiente}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Cargo</div>
              <div class="info-value">${solicitud.cargoSolicitante}</div>
            </div>
          </div>
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Prioridad</div>
              <div class="info-value priority-${(solicitud.prioridadSolicitud || '').toLowerCase()}">${solicitud.prioridadSolicitud || 'Normal'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Fecha de Solicitud</div>
              <div class="info-value">${solicitud.fechaSolicitud ? new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CO') : 'N/A'}</div>
            </div>
            ${solicitud.nombresAdmin ? `
            <div class="info-item">
              <div class="info-label">Aprobado por</div>
              <div class="info-value">${solicitud.nombresAdmin}</div>
            </div>
            ` : '<div class="info-item"></div>'}
          </div>
        </div>
      </div>

      ${cotizacion.proveedorNombre ? `
      <div class="section">
        <div class="section-header">INFORMACIÓN DEL PROVEEDOR</div>
        <div class="section-body">
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Razón Social</div>
              <div class="info-value">${cotizacion.proveedorNombre}</div>
            </div>
            <div class="info-item">
              <div class="info-label">NIT / C.C.</div>
              <div class="info-value">${cotizacion.proveedorNit || 'N/A'}</div>
            </div>
          </div>
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Ciudad</div>
              <div class="info-value">${cotizacion.proveedorCiudad || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Departamento</div>
              <div class="info-value">${cotizacion.proveedorDepartamento || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${solicitud.descripcionIA || solicitud.descripcionSolicitud ? `
      <div class="section">
        <div class="section-header">DESCRIPCIÓN</div>
        <div class="section-body">
          <div style="white-space:pre-wrap;font-size:12px;color:#374151;">${solicitud.descripcionIA || solicitud.descripcionSolicitud}</div>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-header">DETALLE DE ÍTEMS (COTIZACIÓN)</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Cant.</th>
              <th>Valor Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${cotizacion.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.descripcion}</td>
                <td>${item.unidadMedida || 'N/A'}</td>
                <td style="text-align:center">${item.cantidad}</td>
                <td style="text-align:right">$${(item.valorUnitario || 0).toLocaleString('es-CO')}</td>
                <td style="text-align:right">$${((item.valorUnitario || 0) * (item.cantidad || 0)).toLocaleString('es-CO')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="totals-box">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toLocaleString('es-CO')}</span>
            </div>
            ${iva > 0 ? `
            <div class="totals-row">
              <span>IVA:</span>
              <span>$${iva.toLocaleString('es-CO')}</span>
            </div>
            ` : ''}
            ${retencion > 0 ? `
            <div class="totals-row">
              <span>Retención:</span>
              <span>-$${retencion.toLocaleString('es-CO')}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
              <span>TOTAL:</span>
              <span>$${totalNeto.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>

      ${cotizacion.documentoUrl ? `
      <div class="cotizacion-ref">
         📎 <strong>Cotización de referencia:</strong> 
         <a href="${cotizacion.documentoUrl}">Ver cotización adjunta</a>
      </div>
      ` : ''}

      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line">SOLICITANTE<br/>${solicitud.nombreSolicitante}</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">AUTORIZADO POR<br/>${solicitud.nombresAdmin || '_______________'}</div>
        </div>
      </div>

      <div class="footer">
        <p>Documento generado automáticamente por Sirius Financiero — ${new Date().toLocaleString('es-CO')}</p>
      </div>
    </body>
    </html>
  `;
}
