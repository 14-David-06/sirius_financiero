import { NextRequest, NextResponse } from 'next/server';
import { AirtableRecord, AirtableResponse, CompraCompleta, EstadisticasData, ApiResponse, AirtableField } from '@/types/compras';
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

// Función auxiliar para procesar arrays de Airtable que pueden contener objetos complejos
function processAirtableArray(field: any): any[] {
  if (!field) return [];
  if (!Array.isArray(field)) return [];
  
  return field.map(item => {
    if (typeof item === 'object' && item !== null) {
      // Si es un objeto con propiedades específicas de Airtable
      if ('value' in item) {
        return item.value;
      } else if ('state' in item) {
        return item.state;
      } else {
        // Para otros objetos, intentar convertir a string
        return String(item);
      }
    }
    return item;
  });
}

// Función auxiliar para procesar campos individuales que pueden contener objetos
function processAirtableField(field: any): any {
  if (typeof field === 'object' && field !== null) {
    // Si es un objeto con propiedades específicas de Airtable
    if ('value' in field) {
      return field.value;
    } else if ('state' in field) {
      return field.state;
    } else {
      // Para otros objetos, intentar convertir a string
      return String(field);
    }
  }
  return field;
}

export async function GET(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    if (!checkRateLimit(clientIP, 20, 60000)) { // 20 requests per minute
      secureLog('⚠️ Rate limit excedido en GET compras', { ip: clientIP });
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
    const rawMaxRecords = searchParams.get('maxRecords') || '100';

    // Validar y sanitizar parámetros
    const filterByUser = rawFilterByUser ? sanitizeInput(rawFilterByUser) : null;
    const maxRecords = Math.min(parseInt(rawMaxRecords) || 100, 500); // Límite máximo de 500

    // Construir URL para obtener compras
    const comprasUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}`;
    let comprasQuery = `?maxRecords=${maxRecords}&sort[0][field]=Fecha de solicitud&sort[0][direction]=desc`;
    
    if (filterByUser) {
      const escapedUser = escapeAirtableQuery(filterByUser);
      const filterFormula = `{Nombre Solicitante} = "${escapedUser}"`;
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
        fechaSolicitud: processAirtableField(compra.fields['Fecha de solicitud']),
        areaCorrespondiente: processAirtableField(compra.fields['Area Correspondiente']),
        nombreSolicitante: processAirtableField(compra.fields['Nombre Solicitante']),
        cargoSolicitante: processAirtableField(compra.fields['Cargo Solicitante']),
        descripcionSolicitud: processAirtableField(compra.fields['Descripcion Solicitud Transcripcion']),
        descripcionIA: processAirtableField(compra.fields['Descripcion Solicitud IAInterpretacion']),
        hasProvider: processAirtableField(compra.fields['HasProvider']),
        razonSocialProveedor: processAirtableField(compra.fields['Razon Social Proveedor']),
        cotizacionDoc: processAirtableField(compra.fields['Cotizacion Doc']),
        documentoSolicitud: processAirtableField(compra.fields['Documento Solicitud']),
        valorTotal: processAirtableField(compra.fields['Valor Total']),
        iva: processAirtableField(compra.fields['IVA']),
        totalNeto: processAirtableField(compra.fields['Total Neto']),
        estadoSolicitud: processAirtableField(compra.fields['Estado Solicitud']),
        prioridadSolicitud: processAirtableField(compra.fields['Prioridad Solicitud']),
        retencion: processAirtableField(compra.fields['Retencion']),
        baseMinimaEnPesos: processAirtableField(compra.fields['Base minima en pesos']),
        baseMinimaEnUVT: processAirtableField(compra.fields['Base minima en UVT']),
        valorUVT: processAirtableField(compra.fields['valor UVT']),
        compraServicio: processAirtableArray(compra.fields['Compra/Servicio']),
        
        // Información del proveedor
        nombreProveedor: processAirtableArray(compra.fields['Nombre (from Proveedor)']),
        nitProveedor: processAirtableArray(compra.fields['C.c o Nit (from Proveedor)']),
        autoretenedor: processAirtableArray(compra.fields['Autoretenedor (from Proveedor)']),
        responsableIVA: processAirtableArray(compra.fields['ResponsableIVA (from Proveedor)']),
        responsableICA: processAirtableArray(compra.fields['ResponsableICA (from Proveedor)']),
        tarifaActividad: processAirtableArray(compra.fields['TarifaActividad (from Proveedor)']),
        ciudadProveedor: processAirtableArray(compra.fields['Ciudad_Proveedor (from Proveedor)']),
        departamentoProveedor: processAirtableArray(compra.fields['Departamento (from Departamento ) (from Proveedor)']),
        rutProveedor: compra.fields['RUT (from Proveedor)'] as AirtableField[],
        contribuyente: processAirtableArray(compra.fields['Contribuyente (from Proveedor)']),
        facturadorElectronico: processAirtableArray(compra.fields['Facturador electronico (from Proveedor)']),
        personaProveedor: processAirtableArray(compra.fields['Persona (from Proveedor)']),
        declaranteRenta: processAirtableArray(compra.fields['Declarante de renta (from Proveedor)']),
        
        // Información de movimiento bancario - procesar objetos complejos
        numeroSemanaBancario: processAirtableArray(compra.fields['Numero semana formulado (from Copia de Declarante de renta (from Proveedor))']),
        clasificacionBancaria: processAirtableArray(compra.fields['Clasificacion (from Copia de Declarante de renta (from Proveedor))']),
        valorBancario: processAirtableArray(compra.fields['Valor (from Copia de Declarante de renta (from Proveedor))']),
        proyeccionBancaria: processAirtableArray(compra.fields['Proyeccion (from Copia de Declarante de renta (from Proveedor))']),
        
        // Nombre del admin que aprobó/rechazó (nuevo campo)
        nombresAdmin: processAirtableField(compra.fields['Nombres Admin']),
        
        items: itemsRelacionados.map((item: AirtableRecord) => ({
          id: item.id,
          objeto: processAirtableField(item.fields['Objeto']),
          centroCostos: processAirtableField(item.fields['Centro Costos']),
          cantidad: processAirtableField(item.fields['Cantidad']),
          valorItem: processAirtableField(item.fields['Valor Item']),
          compraServicio: processAirtableField(item.fields['Compra/Servicio']),
          estadoItem: processAirtableField(item.fields['Estado Item']), // Nuevo campo
          prioridad: processAirtableField(item.fields['Prioridad']),
          fechaRequerida: processAirtableField(item.fields['Fecha Requerida Entrega']),
          formaPago: processAirtableField(item.fields['FORMA DE PAGO']),
          aprobacion: processAirtableField(item.fields['Aprobacion']),
          estadoGestion: processAirtableField(item.fields['Estado Gestion']),
          reciboRemision: processAirtableField(item.fields['Recibo/Remision']),
          transporte: processAirtableField(item.fields['Transporte']),
          nombreProveedor: processAirtableArray(item.fields['Nombre (from Proveedor)']),
          nitProveedor: processAirtableArray(item.fields['C.c o Nit (from Proveedor)']),
          correoProveedor: processAirtableArray(item.fields['Correo (from Proveedor)']),
          celularProveedor: processAirtableArray(item.fields['Celular (from Proveedor)']),
          ciudadProveedor: processAirtableArray(item.fields['Ciudad (from Proveedor)']),
          autoretenedorProveedor: processAirtableArray(item.fields['Autoretenedor (from Proveedor)']),
          responsableIVAProveedor: processAirtableArray(item.fields['ResponsableIVA (from Proveedor)']),
          responsableICAProveedor: processAirtableArray(item.fields['ResponsableICA (from Proveedor)']),
          tarifaActividadProveedor: processAirtableArray(item.fields['TarifaActividad (from Proveedor)']),
          departamentoProveedor: processAirtableArray(item.fields['Departamento (from Departamento ) (from Proveedor)']),
          rutProveedor: item.fields['RUT (from Proveedor)'] as AirtableField[],
          personaProveedor: processAirtableArray(item.fields['Persona (from Proveedor)']),
          contribuyenteProveedor: processAirtableArray(item.fields['Contribuyente (from Proveedor)']),
          facturadorElectronicoProveedor: processAirtableArray(item.fields['Facturador electronico (from Proveedor)']),
          declaranteRentaProveedor: processAirtableArray(item.fields['Declarante de renta (from Proveedor)']),
        }))
      };
    });

    // Calcular estadísticas
    const estadisticas: EstadisticasData = {
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
    };

    return NextResponse.json<ApiResponse>({
      compras: comprasConItems,
      estadisticas,
      totalRecords: comprasData.records.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error obteniendo compras:', error);
    secureLog('🚨 Error general en GET compras', { 
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
