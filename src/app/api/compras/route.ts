import { NextRequest, NextResponse } from 'next/server';
import { AirtableRecord, AirtableResponse, CompraCompleta, EstadisticasData, ApiResponse, AirtableField } from '@/types/compras';
import { COMPRAS_FIELDS, ITEMS_COMPRAS_FIELDS } from '@/lib/config/airtable-fields';
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
// Maneja casos como JSON strings con {state, value, isStale} de respuestas de IA
function processAirtableField(field: any): any {
  if (field === null || field === undefined) return field;
  
  // Si es un string, verificar si es un JSON con state/value
  if (typeof field === 'string') {
    // Detectar si parece un JSON con state/value
    if (field.startsWith('{') && field.includes('"state"') && field.includes('"value"')) {
      try {
        const parsed = JSON.parse(field);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          return parsed.value;
        }
      } catch {
        // Si falla el parse, devolver el string original
      }
    }
    return field;
  }
  
  if (typeof field === 'object') {
    // Si es un objeto con propiedades específicas de IA (state, value, isStale)
    if ('value' in field) {
      return field.value;
    } else if ('state' in field) {
      // Evitar devolver solo el state, buscar value primero
      return field.value || field.state;
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
    let comprasQuery = `?maxRecords=${maxRecords}&sort[0][field]=${encodeURIComponent(COMPRAS_FIELDS.FECHA_SOLICITUD)}&sort[0][direction]=desc`;
    
    if (filterByUser) {
      const escapedUser = escapeAirtableQuery(filterByUser);
      const filterFormula = `{${COMPRAS_FIELDS.NOMBRE_SOLICITANTE}} = "${escapedUser}"`;
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
      const itemsIds = (compra.fields[COMPRAS_FIELDS.ITEMS_LINK] as string[]) || [];
      const itemsRelacionados = itemsData.records.filter((item: AirtableRecord) => 
        itemsIds.includes(item.id)
      );

      return {
        id: compra.id,
        fechaSolicitud: processAirtableField(compra.fields[COMPRAS_FIELDS.FECHA_SOLICITUD]),
        areaCorrespondiente: processAirtableField(compra.fields[COMPRAS_FIELDS.AREA_CORRESPONDIENTE]),
        nombreSolicitante: processAirtableField(compra.fields[COMPRAS_FIELDS.NOMBRE_SOLICITANTE]),
        cargoSolicitante: processAirtableField(compra.fields[COMPRAS_FIELDS.CARGO_SOLICITANTE]),
        descripcionSolicitud: processAirtableField(compra.fields[COMPRAS_FIELDS.DESCRIPCION_TRANSCRIPCION]),
        descripcionIA: processAirtableField(compra.fields[COMPRAS_FIELDS.DESCRIPCION_IA]),
        hasProvider: processAirtableField(compra.fields[COMPRAS_FIELDS.HAS_PROVIDER]),
        razonSocialProveedor: processAirtableField(compra.fields[COMPRAS_FIELDS.RAZON_SOCIAL_PROVEEDOR]),
        cotizacionDoc: processAirtableField(compra.fields[COMPRAS_FIELDS.COTIZACION_DOC]),
        documentoSolicitud: processAirtableField(compra.fields[COMPRAS_FIELDS.DOCUMENTO_SOLICITUD]),
        valorTotal: processAirtableField(compra.fields[COMPRAS_FIELDS.VALOR_TOTAL]),
        iva: processAirtableField(compra.fields[COMPRAS_FIELDS.IVA]),
        totalNeto: processAirtableField(compra.fields[COMPRAS_FIELDS.TOTAL_NETO]),
        estadoSolicitud: processAirtableField(compra.fields[COMPRAS_FIELDS.ESTADO_SOLICITUD]),
        prioridadSolicitud: processAirtableField(compra.fields[COMPRAS_FIELDS.PRIORIDAD_SOLICITUD]),
        retencion: processAirtableField(compra.fields[COMPRAS_FIELDS.RETENCION]),
        baseMinimaEnPesos: processAirtableField(compra.fields[COMPRAS_FIELDS.BASE_MINIMA_PESOS]),
        baseMinimaEnUVT: processAirtableField(compra.fields[COMPRAS_FIELDS.BASE_MINIMA_UVT]),
        valorUVT: processAirtableField(compra.fields[COMPRAS_FIELDS.VALOR_UVT]),
        compraServicio: processAirtableArray(compra.fields[COMPRAS_FIELDS.COMPRA_SERVICIO]),
        
        // IDs de registros vinculados
        proveedorRecordId: compra.fields[COMPRAS_FIELDS.PROVEEDOR] as string[],
        cotizacionRecordIds: compra.fields[COMPRAS_FIELDS.COTIZACIONES] as string[],
        
        // Información del proveedor
        nombreProveedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.NOMBRE_FROM_PROVEEDOR]),
        nitProveedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.NIT_FROM_PROVEEDOR]),
        autoretenedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.AUTORETENEDOR_FROM_PROV]),
        responsableIVA: processAirtableArray(compra.fields[COMPRAS_FIELDS.RESPONSABLE_IVA_FROM_PROV]),
        responsableICA: processAirtableArray(compra.fields[COMPRAS_FIELDS.RESPONSABLE_ICA_FROM_PROV]),
        tarifaActividad: processAirtableArray(compra.fields[COMPRAS_FIELDS.TARIFA_ACTIVIDAD_FROM_PROV]),
        ciudadProveedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.CIUDAD_FROM_PROV]),
        departamentoProveedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.DEPARTAMENTO_FROM_PROV]),
        rutProveedor: compra.fields[COMPRAS_FIELDS.RUT_FROM_PROV] as AirtableField[],
        contribuyente: processAirtableArray(compra.fields[COMPRAS_FIELDS.CONTRIBUYENTE_FROM_PROV]),
        facturadorElectronico: processAirtableArray(compra.fields[COMPRAS_FIELDS.FACTURADOR_ELEC_FROM_PROV]),
        personaProveedor: processAirtableArray(compra.fields[COMPRAS_FIELDS.PERSONA_FROM_PROV]),
        declaranteRenta: processAirtableArray(compra.fields[COMPRAS_FIELDS.DECLARANTE_FROM_PROV]),
        
        // Información de movimiento bancario
        numeroSemanaBancario: processAirtableArray(compra.fields[COMPRAS_FIELDS.NUMERO_SEMANA_BANCARIO]),
        clasificacionBancaria: processAirtableArray(compra.fields[COMPRAS_FIELDS.CLASIFICACION_BANCARIA]),
        valorBancario: processAirtableArray(compra.fields[COMPRAS_FIELDS.VALOR_BANCARIO]),
        proyeccionBancaria: processAirtableArray(compra.fields[COMPRAS_FIELDS.PROYECCION_BANCARIA]),
        
        // Nombre del admin que aprobó/rechazó
        nombresAdmin: processAirtableField(compra.fields[COMPRAS_FIELDS.NOMBRES_ADMIN]),
        
        items: itemsRelacionados.map((item: AirtableRecord) => ({
          id: item.id,
          objeto: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.OBJETO]),
          centroCostos: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.CENTRO_COSTOS]),
          cantidad: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.CANTIDAD]),
          valorItem: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.VALOR_ITEM]),
          compraServicio: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.COMPRA_SERVICIO]),
          estadoItem: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.ESTADO_ITEM]),
          prioridad: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.PRIORIDAD]),
          fechaRequerida: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.FECHA_REQUERIDA]),
          formaPago: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.FORMA_PAGO]),
          aprobacion: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.APROBACION]),
          estadoGestion: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.ESTADO_GESTION]),
          reciboRemision: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.RECIBO_REMISION]),
          transporte: processAirtableField(item.fields[ITEMS_COMPRAS_FIELDS.TRANSPORTE]),
          nombreProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.NOMBRE_FROM_PROV]),
          nitProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.NIT_FROM_PROV]),
          correoProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.CORREO_FROM_PROV]),
          celularProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.CELULAR_FROM_PROV]),
          ciudadProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.CIUDAD_FROM_PROV]),
          autoretenedorProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.AUTORETENEDOR_FROM_PROV]),
          responsableIVAProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.RESP_IVA_FROM_PROV]),
          responsableICAProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.RESP_ICA_FROM_PROV]),
          tarifaActividadProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.TARIFA_FROM_PROV]),
          departamentoProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.DEPTO_FROM_PROV]),
          rutProveedor: item.fields[ITEMS_COMPRAS_FIELDS.RUT_FROM_PROV] as AirtableField[],
          personaProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.PERSONA_FROM_PROV]),
          contribuyenteProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.CONTRIBUYENTE_FROM_PROV]),
          facturadorElectronicoProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.FACTURADOR_FROM_PROV]),
          declaranteRentaProveedor: processAirtableArray(item.fields[ITEMS_COMPRAS_FIELDS.DECLARANTE_FROM_PROV]),
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
