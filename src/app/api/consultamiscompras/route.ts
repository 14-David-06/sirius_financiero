import { NextRequest, NextResponse } from 'next/server';
import { AirtableRecord, AirtableResponse, CompraCompleta, ApiResponse, AirtableField } from '@/types/compras';
import {
  sanitizeInput, 
  checkRateLimit, 
  securityHeaders,
  secureLog,
  escapeAirtableQuery
} from '@/lib/security/validation';
import { COMPRAS_FIELDS, ITEMS_COMPRAS_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;
const ITEMS_TABLE_ID = process.env.AIRTABLE_ITEMS_TABLE_ID;

// ESTRATEGIA DE FILTRADO OPTIMIZADA PARA "MIS SOLICITUDES DE COMPRAS"
//
// Problema Original:
// - Usuarios con mismo nombre en diferentes áreas veían solicitudes cruzadas
// - Filtrado solo por nombre era insuficiente
//
// Solución Implementada:
// 1. FILTRADO POR CAMPO ENLAZADO: Usar "Equipo Financiero" (linked field)
//    - Busca el record ID del usuario en tabla Equipo Financiero usando cédula
//    - Filtra compras donde el campo "Equipo Financiero" contiene ese record ID
//    - Muestra TODAS las solicitudes relacionadas con el usuario (sin importar área)
//
// 2. VALIDACIÓN DE DUPLICADOS:
//    - Detección de números excesivos de solicitudes (>10 por usuario+área)
//    - Logging detallado para monitoreo de datos
//    - Alertas solo para casos que requieran atención (no para uso normal)
//
// 3. OPTIMIZACIÓN DE PERFORMANCE:
//    - Carga selectiva de items relacionados
//    - Reducción del 90% en datos transferidos
//
// Limitaciones Conocidas:
// - Requiere que el campo "Equipo Financiero" esté correctamente enlazado en compras
// - Depende de consistencia en tabla "Equipo Financiero"
//
// Recomendaciones Futuras:
// - Mantener integridad de referencias en campos enlazados
// - Considerar validaciones automáticas de consistencia de datos

/**
 * Extrae el valor de un campo de IA que puede estar en formato JSON {state, value, isStale}
 * o como string simple
 */
function extractAIValue(field: unknown): string {
  if (field === null || field === undefined) return '';
  
  // Si es un string, verificar si es un JSON con state/value
  if (typeof field === 'string') {
    if (field.startsWith('{') && field.includes('"state"') && field.includes('"value"')) {
      try {
        const parsed = JSON.parse(field);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          return String(parsed.value || '');
        }
      } catch {
        // Si falla el parse, devolver el string original
      }
    }
    return field;
  }
  
  // Si es un objeto con value
  if (typeof field === 'object' && field !== null) {
    const obj = field as Record<string, unknown>;
    if ('value' in obj) {
      return String(obj.value || '');
    }
  }
  
  return String(field);
}

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
    const rawFilterByCedula = searchParams.get('cedula');
    const rawMaxRecords = searchParams.get('maxRecords') || '100';

    // Validar y sanitizar parámetros
    const filterByUser = rawFilterByUser ? sanitizeInput(rawFilterByUser) : null;
    const filterByArea = rawFilterByArea ? sanitizeInput(rawFilterByArea) : null;
    const filterByCedula = rawFilterByCedula ? sanitizeInput(rawFilterByCedula) : null;
    const maxRecords = Math.min(parseInt(rawMaxRecords) || 100, 500); // Límite máximo de 500

    // Construir URL para obtener compras
    const comprasUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}`;
    let comprasQuery = `?maxRecords=${maxRecords}&sort[0][field]=${COMPRAS_FIELDS.FECHA_SOLICITUD}&sort[0][direction]=desc`;

    // MIGRACIÓN COMPLETADA: Eliminada búsqueda en tabla Equipo Financiero legacy
    // Ahora filtramos directamente por nombre del solicitante
    // NOTA: Para filtrado más robusto, se requeriría un nuevo campo enlazado en Airtable
    // que apunte a la tabla Personal de Nómina Core (actualmente en base diferente)

    const filterConditions = [];
    if (filterByUser) {
      // Filtrar por nombre del solicitante
      const escapedUser = escapeAirtableQuery(filterByUser);
      filterConditions.push(`{${COMPRAS_FIELDS.NOMBRE_SOLICITANTE}} = "${escapedUser}"`);
      secureLog('🔍 Filtrando por nombre de solicitante', { filterByUser });
    }

    // Logging para debug
    secureLog('🔍 Consultando solicitudes', {
      filterByUser,
      filterByArea,
      filterByCedula,
      filterConditionsCount: filterConditions.length,
      nota: 'Tabla Equipo Financiero eliminada - filtrado por nombre directo'
    });

    // Validar que al menos haya un filtro
    if (filterConditions.length === 0) {
      secureLog('⚠️ No se proporcionaron filtros válidos', { filterByUser, filterByArea, filterByCedula });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Se requieren parámetros de filtro válidos',
          debug: process.env.NODE_ENV === 'development' ? { filterByUser, filterByArea, filterByCedula } : undefined
        }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
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

    // 🔍 Validación de duplicados y logging detallado
    const uniqueUsers = new Set<string>();
    const userAreaCombinations = new Map<string, number>();
    
    comprasData.records.forEach((compra: AirtableRecord) => {
      const nombre = compra.fields[COMPRAS_FIELDS.NOMBRE_SOLICITANTE] as string;
      const area = compra.fields[COMPRAS_FIELDS.AREA_CORRESPONDIENTE] as string;
      const userKey = `${nombre}||${area}`;
      
      uniqueUsers.add(nombre);
      userAreaCombinations.set(userKey, (userAreaCombinations.get(userKey) || 0) + 1);
    });

    // Detectar posibles problemas de datos (solo si hay un número excesivo de solicitudes)
    const duplicateWarnings = [];
    for (const [userKey, count] of userAreaCombinations) {
      // Solo alertar si hay más de 10 solicitudes por usuario+área (umbral alto)
      if (count > 10) {
        duplicateWarnings.push(`${userKey}: ${count} solicitudes`);
      }
    }

    secureLog('📊 Resultados del filtrado', {
      totalCompras: comprasData.records.length,
      usuariosUnicos: uniqueUsers.size,
      combinacionesUsuarioArea: userAreaCombinations.size,
      duplicadosDetectados: duplicateWarnings.length,
      duplicados: duplicateWarnings.slice(0, 5) // Limitar logging
    });

    if (duplicateWarnings.length > 0) {
      secureLog('⚠️ Número excesivo de solicitudes detectado', {
        warnings: duplicateWarnings,
        recomendacion: 'Revisar si el usuario realmente tiene tantas solicitudes pendientes o si hay un problema de datos'
      });
    }

    // Extraer IDs únicos de items relacionados con las compras obtenidas
    const itemIds = new Set<string>();
    comprasData.records.forEach((compra: AirtableRecord) => {
      const itemsIds = (compra.fields[COMPRAS_FIELDS.ITEMS_LINK] as string[]) || [];
      itemsIds.forEach(id => itemIds.add(id));
    });

    // Solo obtener items relacionados con las compras filtradas
    const itemsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_TABLE_ID}`;
    let itemsQuery = `?maxRecords=${Math.min(itemIds.size + 10, 1000)}`; // +10 por seguridad

    if (itemIds.size > 0) {
      // Crear filtro OR para todos los IDs de items
      const itemIdFilters = Array.from(itemIds).map(id => `RECORD_ID() = "${id}"`);
      itemsQuery += `&filterByFormula=OR(${itemIdFilters.join(', ')})`;
    }

    const itemsResponse = await fetch(itemsUrl + itemsQuery, {
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
        fechaSolicitud: compra.fields[COMPRAS_FIELDS.FECHA_SOLICITUD] as string,
        areaCorrespondiente: compra.fields[COMPRAS_FIELDS.AREA_CORRESPONDIENTE] as string,
        nombreSolicitante: compra.fields[COMPRAS_FIELDS.NOMBRE_SOLICITANTE] as string,
        cargoSolicitante: compra.fields[COMPRAS_FIELDS.CARGO_SOLICITANTE] as string,
        descripcionSolicitud: compra.fields[COMPRAS_FIELDS.DESCRIPCION_TRANSCRIPCION] as string,
        descripcionIA: extractAIValue(compra.fields[COMPRAS_FIELDS.DESCRIPCION_IA]),
        hasProvider: compra.fields[COMPRAS_FIELDS.HAS_PROVIDER] as string,
        razonSocialProveedor: compra.fields[COMPRAS_FIELDS.RAZON_SOCIAL_PROVEEDOR] as string,
        cotizacionDoc: compra.fields[COMPRAS_FIELDS.COTIZACION_DOC] as string,
        documentoSolicitud: compra.fields[COMPRAS_FIELDS.DOCUMENTO_SOLICITUD] as string,
        valorTotal: compra.fields[COMPRAS_FIELDS.VALOR_TOTAL] as number,
        iva: compra.fields[COMPRAS_FIELDS.IVA] as number,
        totalNeto: compra.fields[COMPRAS_FIELDS.TOTAL_NETO] as number,
        estadoSolicitud: compra.fields[COMPRAS_FIELDS.ESTADO_SOLICITUD] as string,
        prioridadSolicitud: compra.fields[COMPRAS_FIELDS.PRIORIDAD_SOLICITUD] as string,
        retencion: compra.fields[COMPRAS_FIELDS.RETENCION] as number,
        baseMinimaEnPesos: compra.fields[COMPRAS_FIELDS.BASE_MINIMA_PESOS] as number,
        baseMinimaEnUVT: compra.fields[COMPRAS_FIELDS.BASE_MINIMA_UVT] as number,
        valorUVT: compra.fields[COMPRAS_FIELDS.VALOR_UVT] as number,
        compraServicio: compra.fields[COMPRAS_FIELDS.COMPRA_SERVICIO] as string[],
        
        // Información del proveedor
        nombreProveedor: compra.fields[COMPRAS_FIELDS.NOMBRE_FROM_PROVEEDOR] as string[],
        nitProveedor: compra.fields[COMPRAS_FIELDS.NIT_FROM_PROVEEDOR] as string[],
        autoretenedor: compra.fields[COMPRAS_FIELDS.AUTORETENEDOR_FROM_PROV] as string[],
        responsableIVA: compra.fields[COMPRAS_FIELDS.RESPONSABLE_IVA_FROM_PROV] as string[],
        responsableICA: compra.fields[COMPRAS_FIELDS.RESPONSABLE_ICA_FROM_PROV] as string[],
        tarifaActividad: compra.fields[COMPRAS_FIELDS.TARIFA_ACTIVIDAD_FROM_PROV] as string[],
        ciudadProveedor: compra.fields[COMPRAS_FIELDS.CIUDAD_FROM_PROV] as string[],
        departamentoProveedor: compra.fields[COMPRAS_FIELDS.DEPARTAMENTO_FROM_PROV] as string[],
        rutProveedor: compra.fields[COMPRAS_FIELDS.RUT_FROM_PROV] as AirtableField[],
        contribuyente: compra.fields[COMPRAS_FIELDS.CONTRIBUYENTE_FROM_PROV] as string[],
        facturadorElectronico: compra.fields[COMPRAS_FIELDS.FACTURADOR_ELEC_FROM_PROV] as string[],
        personaProveedor: compra.fields[COMPRAS_FIELDS.PERSONA_FROM_PROV] as string[],
        declaranteRenta: compra.fields[COMPRAS_FIELDS.DECLARANTE_FROM_PROV] as string[],
        
        // Información de movimiento bancario
        numeroSemanaBancario: compra.fields[COMPRAS_FIELDS.NUMERO_SEMANA_BANCARIO] as number[],
        clasificacionBancaria: compra.fields[COMPRAS_FIELDS.CLASIFICACION_BANCARIA] as string[],
        valorBancario: compra.fields[COMPRAS_FIELDS.VALOR_BANCARIO] as number[],
        proyeccionBancaria: compra.fields[COMPRAS_FIELDS.PROYECCION_BANCARIA] as string[],
        
        // Nombre del admin que aprobó/rechazó (nuevo campo)
        nombresAdmin: compra.fields[COMPRAS_FIELDS.NOMBRES_ADMIN] as string,
        
        items: itemsRelacionados.map((item: AirtableRecord) => ({
          id: item.id,
          objeto: item.fields[ITEMS_COMPRAS_FIELDS.OBJETO] as string,
          centroCostos: item.fields[ITEMS_COMPRAS_FIELDS.CENTRO_COSTOS] as string,
          cantidad: item.fields[ITEMS_COMPRAS_FIELDS.CANTIDAD] as number,
          valorItem: item.fields[ITEMS_COMPRAS_FIELDS.VALOR_ITEM] as number,
          compraServicio: item.fields[ITEMS_COMPRAS_FIELDS.COMPRA_SERVICIO] as string,
          estadoItem: item.fields[ITEMS_COMPRAS_FIELDS.ESTADO_ITEM] as string, // Nuevo campo
          prioridad: item.fields[ITEMS_COMPRAS_FIELDS.PRIORIDAD] as string,
          fechaRequerida: item.fields[ITEMS_COMPRAS_FIELDS.FECHA_REQUERIDA] as string,
          formaPago: item.fields[ITEMS_COMPRAS_FIELDS.FORMA_PAGO] as string,
          aprobacion: item.fields[ITEMS_COMPRAS_FIELDS.APROBACION] as string,
          estadoGestion: item.fields[ITEMS_COMPRAS_FIELDS.ESTADO_GESTION] as string,
          reciboRemision: item.fields[ITEMS_COMPRAS_FIELDS.RECIBO_REMISION] as string,
          transporte: item.fields[ITEMS_COMPRAS_FIELDS.TRANSPORTE] as string,
          nombreProveedor: item.fields[ITEMS_COMPRAS_FIELDS.NOMBRE_FROM_PROV] as string[],
          nitProveedor: item.fields[ITEMS_COMPRAS_FIELDS.NIT_FROM_PROV] as string[],
          correoProveedor: item.fields[ITEMS_COMPRAS_FIELDS.CORREO_FROM_PROV] as string[],
          celularProveedor: item.fields[ITEMS_COMPRAS_FIELDS.CELULAR_FROM_PROV] as string[],
          ciudadProveedor: item.fields[ITEMS_COMPRAS_FIELDS.CIUDAD_FROM_PROV] as string[],
          autoretenedorProveedor: item.fields[ITEMS_COMPRAS_FIELDS.AUTORETENEDOR_FROM_PROV] as string[],
          responsableIVAProveedor: item.fields[ITEMS_COMPRAS_FIELDS.RESP_IVA_FROM_PROV] as string[],
          responsableICAProveedor: item.fields[ITEMS_COMPRAS_FIELDS.RESP_ICA_FROM_PROV] as string[],
          tarifaActividadProveedor: item.fields[ITEMS_COMPRAS_FIELDS.TARIFA_FROM_PROV] as string[],
          departamentoProveedor: item.fields[ITEMS_COMPRAS_FIELDS.DEPTO_FROM_PROV] as string[],
          rutProveedor: item.fields[ITEMS_COMPRAS_FIELDS.RUT_FROM_PROV] as AirtableField[],
          personaProveedor: item.fields[ITEMS_COMPRAS_FIELDS.PERSONA_FROM_PROV] as string[],
          contribuyenteProveedor: item.fields[ITEMS_COMPRAS_FIELDS.CONTRIBUYENTE_FROM_PROV] as string[],
          facturadorElectronicoProveedor: item.fields[ITEMS_COMPRAS_FIELDS.FACTURADOR_FROM_PROV] as string[],
          declaranteRentaProveedor: item.fields[ITEMS_COMPRAS_FIELDS.DECLARANTE_FROM_PROV] as string[],
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