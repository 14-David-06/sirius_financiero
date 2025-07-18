import { NextRequest, NextResponse } from 'next/server';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COMPRAS_TABLE_ID = 'tblC7QjS4OeexqlbM'; // ID de la tabla Compras y Adquisiciones
const ITEMS_TABLE_ID = 'tblkKheSajdYRiAAl'; // ID de la tabla Items Compras y Adquisiciones

export async function GET(request: NextRequest) {
  try {
    // Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const filterByUser = searchParams.get('user');
    const maxRecords = searchParams.get('maxRecords') || '100';

    // Construir URL para obtener compras
    const comprasUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}`;
    let comprasQuery = `?maxRecords=${maxRecords}&sort[0][field]=Fecha de solicitud&sort[0][direction]=desc`;
    
    if (filterByUser) {
      const filterFormula = `{Nombre Solicitante} = "${filterByUser}"`;
      comprasQuery += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    }

    // Obtener compras
    const comprasResponse = await fetch(comprasUrl + comprasQuery, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!comprasResponse.ok) {
      return NextResponse.json(
        { error: 'Error al obtener compras' },
        { status: 500 }
      );
    }

    const comprasData = await comprasResponse.json();

    // Obtener items relacionados
    const itemsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_TABLE_ID}`;
    const itemsResponse = await fetch(`${itemsUrl}?maxRecords=1000`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!itemsResponse.ok) {
      return NextResponse.json(
        { error: 'Error al obtener items' },
        { status: 500 }
      );
    }

    const itemsData = await itemsResponse.json();

    // Procesar y combinar datos
    const comprasConItems = comprasData.records.map((compra: any) => {
      const itemsIds = compra.fields['Items Compras y Adquisiciones'] || [];
      const itemsRelacionados = itemsData.records.filter((item: any) => 
        itemsIds.includes(item.id)
      );

      return {
        id: compra.id,
        fechaSolicitud: compra.fields['Fecha de solicitud'],
        areaCorrespondiente: compra.fields['Area Correspondiente'],
        nombreSolicitante: compra.fields['Nombre Solicitante'],
        cargoSolicitante: compra.fields['Cargo Solicitante'],
        descripcionSolicitud: compra.fields['Descripcion Solicitud Transcripcion'],
        descripcionIA: compra.fields['Descripcion Solicitud IAInterpretacion'],
        hasProvider: compra.fields['HasProvider'],
        razonSocialProveedor: compra.fields['Razon Social Proveedor'],
        cotizacionDoc: compra.fields['Cotizacion Doc'],
        documentoSolicitud: compra.fields['Documento Solicitud'],
        valorTotal: compra.fields['Valor Total'],
        iva: compra.fields['IVA'],
        totalNeto: compra.fields['Total Neto'],
        estadoSolicitud: compra.fields['Estado Solicitud'],
        retencion: compra.fields['Retencion'],
        baseMinimaEnPesos: compra.fields['Base minima en pesos'],
        items: itemsRelacionados.map((item: any) => ({
          id: item.id,
          objeto: item.fields['Objeto'],
          centroCostos: item.fields['Centro Costos'],
          cantidad: item.fields['Cantidad'],
          valorItem: item.fields['Valor Item'],
          compraServicio: item.fields['Compra/Servicio'],
          prioridad: item.fields['Prioridad'],
          fechaRequerida: item.fields['Fecha Requerida Entrega'],
          formaPago: item.fields['FORMA DE PAGO'],
          aprobacion: item.fields['Aprobacion'],
          estadoGestion: item.fields['Estado Gestion'],
          nombreProveedor: item.fields['Nombre (from Proveedor)'],
          nitProveedor: item.fields['C.c o Nit (from Proveedor)'],
          correoProveedor: item.fields['Correo (from Proveedor)'],
          celularProveedor: item.fields['Celular (from Proveedor)'],
        }))
      };
    });

    // Calcular estadísticas
    const estadisticas = {
      totalCompras: comprasConItems.length,
      totalItems: comprasConItems.reduce((sum: number, compra: any) => sum + compra.items.length, 0),
      montoTotal: comprasConItems.reduce((sum: number, compra: any) => sum + (compra.valorTotal || 0), 0),
      montoTotalNeto: comprasConItems.reduce((sum: number, compra: any) => sum + (compra.totalNeto || 0), 0),
      distribucionEstados: comprasConItems.reduce((acc: Record<string, number>, compra: any) => {
        const estado = compra.estadoSolicitud || 'Sin estado';
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      distribucionAreas: comprasConItems.reduce((acc: Record<string, number>, compra: any) => {
        const area = compra.areaCorrespondiente || 'Sin área';
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      compras: comprasConItems,
      estadisticas,
      totalRecords: comprasData.records.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error obteniendo compras:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
