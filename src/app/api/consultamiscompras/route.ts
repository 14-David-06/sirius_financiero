import { NextRequest, NextResponse } from 'next/server';
import { AirtableRecord, AirtableResponse, CompraCompleta, ApiResponse, AirtableField } from '@/types/compras';
import { 
  sanitizeInput, 
  checkRateLimit, 
  securityHeaders,
  secureLog,
  escapeAirtableQuery
} from '@/lib/security/validation';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;
const ITEMS_TABLE_ID = process.env.AIRTABLE_ITEMS_TABLE_ID;

export async function GET(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    if (!checkRateLimit(clientIP, 20, 60000)) { // 20 requests per minute
      secureLog('⚠️ Rate limit excedido en GET consultamiscompras', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        { 
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Validar configuración de Airtable
    const envCheck = {
      AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
      AIRTABLE_API_KEY: !!AIRTABLE_API_KEY,
      COMPRAS_TABLE_ID: !!COMPRAS_TABLE_ID,
      ITEMS_TABLE_ID: !!ITEMS_TABLE_ID
    };

    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !COMPRAS_TABLE_ID || !ITEMS_TABLE_ID) {
      secureLog('🚨 Configuración de Airtable no encontrada', { envCheck });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Configuración de Airtable no encontrada',
          debug: process.env.NODE_ENV === 'development' ? envCheck : undefined
        }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Obtener y validar parámetros de consulta
    const { searchParams } = new URL(request.url);
    const rawFilterByUser = searchParams.get('user');
    const rawFilterByArea = searchParams.get('area');
    const rawMaxRecords = searchParams.get('maxRecords') || '100';

    // Validar y sanitizar parámetros
    const filterByUser = rawFilterByUser ? sanitizeInput(rawFilterByUser) : null;
    const filterByArea = rawFilterByArea ? sanitizeInput(rawFilterByArea) : null;
    const maxRecords = Math.min(parseInt(rawMaxRecords) || 100, 500); // Límite máximo de 500

    // Construir URL para obtener compras
    const comprasUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}`;
    let comprasQuery = `?maxRecords=${maxRecords}&sort[0][field]=Fecha de solicitud&sort[0][direction]=desc`;
    
    // Construir filtro para usuario y/o área
    let filterConditions = [];
    if (filterByUser) {
      const escapedUser = escapeAirtableQuery(filterByUser);
      filterConditions.push(`{Nombre Solicitante} = "${escapedUser}"`);
    }
    if (filterByArea) {
      const escapedArea = escapeAirtableQuery(filterByArea);
      filterConditions.push(`{Area Correspondiente} = "${escapedArea}"`);
    }
    
    if (filterConditions.length > 0) {
      const filterFormula = filterConditions.join(', ');
      comprasQuery += `&filterByFormula=OR(${filterFormula})`;
    }

    // Obtener compras
    const comprasResponse = await fetch(comprasUrl + comprasQuery, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!comprasResponse.ok) {
      const errorText = await comprasResponse.text();
      secureLog('🚨 Error al obtener compras', { 
        status: comprasResponse.status,
        statusText: comprasResponse.statusText,
        url: comprasUrl + comprasQuery,
        errorText: errorText.substring(0, 200) // Solo los primeros 200 chars para seguridad
      });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Error al obtener compras',
          details: process.env.NODE_ENV === 'development' ? {
            status: comprasResponse.status,
            statusText: comprasResponse.statusText
          } : undefined
        }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const comprasData: AirtableResponse = await comprasResponse.json();

    // Obtener items relacionados
    const itemsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_TABLE_ID}`;
    const itemsResponse = await fetch(`${itemsUrl}?maxRecords=1000`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text();
      secureLog('🚨 Error al obtener items', { 
        status: itemsResponse.status,
        statusText: itemsResponse.statusText,
        url: `${itemsUrl}?maxRecords=1000`,
        errorText: errorText.substring(0, 200)
      });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Error al obtener items',
          details: process.env.NODE_ENV === 'development' ? {
            status: itemsResponse.status,
            statusText: itemsResponse.statusText
          } : undefined
        }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const itemsData: AirtableResponse = await itemsResponse.json();

    // Procesar y combinar datos
    const comprasConItems: CompraCompleta[] = comprasData.records.map((compra: AirtableRecord) => {
      const itemsIds = (compra.fields['Items Compras y Adquisiciones'] as string[]) || [];
      const itemsRelacionados = itemsData.records.filter((item: AirtableRecord) => 
        itemsIds.includes(item.id)
      );

      return {
        id: compra.id,
        fechaSolicitud: compra.fields['Fecha de solicitud'] as string,
        areaCorrespondiente: compra.fields['Area Correspondiente'] as string,
        nombreSolicitante: compra.fields['Nombre Solicitante'] as string,
        cargoSolicitante: compra.fields['Cargo Solicitante'] as string,
        descripcionSolicitud: compra.fields['Descripcion Solicitud Transcripcion'] as string,
        descripcionIA: compra.fields['Descripcion Solicitud IAInterpretacion'] as string,
        hasProvider: compra.fields['HasProvider'] as string,
        razonSocialProveedor: compra.fields['Razon Social Proveedor'] as string,
        cotizacionDoc: compra.fields['Cotizacion Doc'] as string,
        documentoSolicitud: compra.fields['Documento Solicitud'] as string,
        valorTotal: compra.fields['Valor Total'] as number,
        iva: compra.fields['IVA'] as number,
        totalNeto: compra.fields['Total Neto'] as number,
        estadoSolicitud: compra.fields['Estado Solicitud'] as string,
        prioridadSolicitud: compra.fields['Prioridad Solicitud'] as string,
        retencion: compra.fields['Retencion'] as number,
        baseMinimaEnPesos: compra.fields['Base minima en pesos'] as number,
        baseMinimaEnUVT: compra.fields['Base minima en UVT'] as number,
        valorUVT: compra.fields['valor UVT'] as number,
        compraServicio: compra.fields['Compra/Servicio'] as string[],
        
        // Información del proveedor
        nombreProveedor: compra.fields['Nombre (from Proveedor)'] as string[],
        nitProveedor: compra.fields['C.c o Nit (from Proveedor)'] as string[],
        autoretenedor: compra.fields['Autoretenedor (from Proveedor)'] as string[],
        responsableIVA: compra.fields['ResponsableIVA (from Proveedor)'] as string[],
        responsableICA: compra.fields['ResponsableICA (from Proveedor)'] as string[],
        tarifaActividad: compra.fields['TarifaActividad (from Proveedor)'] as string[],
        ciudadProveedor: compra.fields['Ciudad_Proveedor (from Proveedor)'] as string[],
        departamentoProveedor: compra.fields['Departamento (from Departamento ) (from Proveedor)'] as string[],
        rutProveedor: compra.fields['RUT (from Proveedor)'] as AirtableField[],
        contribuyente: compra.fields['Contribuyente (from Proveedor)'] as string[],
        facturadorElectronico: compra.fields['Facturador electronico (from Proveedor)'] as string[],
        personaProveedor: compra.fields['Persona (from Proveedor)'] as string[],
        declaranteRenta: compra.fields['Declarante de renta (from Proveedor)'] as string[],
        
        // Información de movimiento bancario
        numeroSemanaBancario: compra.fields['Numero semana formulado (from Copia de Declarante de renta (from Proveedor))'] as number[],
        clasificacionBancaria: compra.fields['Clasificacion (from Copia de Declarante de renta (from Proveedor))'] as string[],
        valorBancario: compra.fields['Valor (from Copia de Declarante de renta (from Proveedor))'] as number[],
        proyeccionBancaria: compra.fields['Proyeccion (from Copia de Declarante de renta (from Proveedor))'] as string[],
        
        // Nombre del admin que aprobó/rechazó (nuevo campo)
        nombresAdmin: compra.fields['Nombres Admin'] as string,
        
        items: itemsRelacionados.map((item: AirtableRecord) => ({
          id: item.id,
          objeto: item.fields['Objeto'] as string,
          centroCostos: item.fields['Centro Costos'] as string,
          cantidad: item.fields['Cantidad'] as number,
          valorItem: item.fields['Valor Item'] as number,
          compraServicio: item.fields['Compra/Servicio'] as string,
          estadoItem: item.fields['Estado Item'] as string, // Nuevo campo
          prioridad: item.fields['Prioridad'] as string,
          fechaRequerida: item.fields['Fecha Requerida Entrega'] as string,
          formaPago: item.fields['FORMA DE PAGO'] as string,
          aprobacion: item.fields['Aprobacion'] as string,
          estadoGestion: item.fields['Estado Gestion'] as string,
          reciboRemision: item.fields['Recibo/Remision'] as string,
          transporte: item.fields['Transporte'] as string,
          nombreProveedor: item.fields['Nombre (from Proveedor)'] as string[],
          nitProveedor: item.fields['C.c o Nit (from Proveedor)'] as string[],
          correoProveedor: item.fields['Correo (from Proveedor)'] as string[],
          celularProveedor: item.fields['Celular (from Proveedor)'] as string[],
          ciudadProveedor: item.fields['Ciudad (from Proveedor)'] as string[],
          autoretenedorProveedor: item.fields['Autoretenedor (from Proveedor)'] as string[],
          responsableIVAProveedor: item.fields['ResponsableIVA (from Proveedor)'] as string[],
          responsableICAProveedor: item.fields['ResponsableICA (from Proveedor)'] as string[],
          tarifaActividadProveedor: item.fields['TarifaActividad (from Proveedor)'] as string[],
          departamentoProveedor: item.fields['Departamento (from Departamento ) (from Proveedor)'] as string[],
          rutProveedor: item.fields['RUT (from Proveedor)'] as AirtableField[],
          personaProveedor: item.fields['Persona (from Proveedor)'] as string[],
          contribuyenteProveedor: item.fields['Contribuyente (from Proveedor)'] as string[],
          facturadorElectronicoProveedor: item.fields['Facturador electronico (from Proveedor)'] as string[],
          declaranteRentaProveedor: item.fields['Declarante de renta (from Proveedor)'] as string[],
        }))
      };
    });

    return NextResponse.json<ApiResponse>({
      compras: comprasConItems,
      estadisticas: {
        totalCompras: comprasConItems.length,
        totalItems: comprasConItems.reduce((sum: number, compra: CompraCompleta) => sum + compra.items.length, 0),
        montoTotal: comprasConItems.reduce((sum: number, compra: CompraCompleta) => sum + (compra.valorTotal || 0), 0),
        montoTotalNeto: comprasConItems.reduce((sum: number, compra: CompraCompleta) => sum + (compra.totalNeto || 0), 0),
        distribucionEstados: comprasConItems.reduce((acc: Record<string, number>, compra: CompraCompleta) => {
          const estado = compra.estadoSolicitud || 'Sin estado';
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        distribucionAreas: comprasConItems.reduce((acc: Record<string, number>, compra: CompraCompleta) => {
          const area = compra.areaCorrespondiente || 'Sin área';
          acc[area] = (acc[area] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      totalRecords: comprasData.records.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error obteniendo compras:', error);
    secureLog('🚨 Error general en GET consultamiscompras', { 
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    });
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
        debug: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : 'Error desconocido'
        } : undefined
      }),
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}