import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { securityHeaders } from '@/lib/security/validation';
import { COMPRAS_FIELDS, ITEMS_COMPRAS_FIELDS } from '@/lib/config/airtable-fields';

interface SolicitudCompraData {
  // Datos del solicitante
  nombreSolicitante: string;
  areaSolicitante: string;
  cargoSolicitante: string;
  
  // Datos de la solicitud
  descripcionTranscripcion?: string;
  // descripcionIAInterpretacion?: string; // Campo computado en Airtable, no se envía directamente
  hasProvider: 'si' | 'no';
  razonSocialProveedor?: string;
  cotizacionDoc?: string;
  prioridadSolicitud: 'Alta' | 'Media' | 'Baja';
  
  // Items de compra
  items: Array<{
    objeto: string;
    centroCostos: string;
    cantidad: number;
    valorItem: number;
    compraServicio: 'Servicios (Generales)' | 'Compras (Generales)' | 'Arrendamiento (Bienes Muebles)' | 'Arrendamiento (Bienes inmuebles)' | 'Construcción (Contrato de construcción)' | 'Servicios (Restaurante, Hotel, Alojamiento)' | 'Transporte (Nacional de carga - Todas las modalidades)' | 'Transporte (Nacional pasajeros - Terrestre)' | 'Honorarios (Honorarios - comisiones)';
    prioridad: 'Alta' | 'Media' | 'Baja';
    fechaRequerida?: string;
    formaPago?: '15 DÍAS' | '30 DÍAS' | 'DE CONTADO' | 'ANTICIPO (%)';
    justificacion?: string;
  }>;
}

interface AirtableRecord {
  fields: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const data: SolicitudCompraData = await request.json();
    
    // Verificar credenciales de Airtable
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const comprasTableId = process.env.AIRTABLE_COMPRAS_TABLE_ID;
    const itemsTableId = process.env.AIRTABLE_ITEMS_TABLE_ID;
    
    if (!apiKey || !baseId || !comprasTableId || !itemsTableId) {
      console.error('Missing Airtable credentials');
      return NextResponse.json(
        { error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Valor UVT actual (debe ser configurable)
    const valorUVT = 49799;

    // Paso 1: Crear los items (solo si existen items en la solicitud)
    const itemsCreados = [];
    
    // SOLO CREAR ITEMS SI EXISTEN EN LA SOLICITUD
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const itemRecord: AirtableRecord = {
          fields: {
            [ITEMS_COMPRAS_FIELDS.OBJETO]: item.objeto,
            [ITEMS_COMPRAS_FIELDS.CENTRO_COSTOS]: item.centroCostos,
            [ITEMS_COMPRAS_FIELDS.CANTIDAD]: item.cantidad,
            [ITEMS_COMPRAS_FIELDS.VALOR_ITEM]: item.valorItem,
            [ITEMS_COMPRAS_FIELDS.VALOR_UVT]: valorUVT,
            [ITEMS_COMPRAS_FIELDS.ESTADO_ITEM]: 'Sin comprar',
            [ITEMS_COMPRAS_FIELDS.COMPRA_SERVICIO]: item.compraServicio,
            [ITEMS_COMPRAS_FIELDS.PRIORIDAD]: item.prioridad
          }
        };

        // Agregar campos opcionales si están presentes
        if (item.fechaRequerida) {
          itemRecord.fields[ITEMS_COMPRAS_FIELDS.FECHA_REQUERIDA] = item.fechaRequerida;
        }
        
        if (item.formaPago) {
          itemRecord.fields[ITEMS_COMPRAS_FIELDS.FORMA_PAGO] = item.formaPago;
        }

        if (item.justificacion) {
          itemRecord.fields[ITEMS_COMPRAS_FIELDS.RECIBO_REMISION] = item.justificacion;
        }

        const itemResponse = await fetch(
          `https://api.airtable.com/v0/${baseId}/${itemsTableId}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ records: [itemRecord] })
          }
        );

        if (!itemResponse.ok) {
          const errorData = await itemResponse.json();
          console.error('Error creating item:', errorData);
          throw new Error(`Error al crear item: ${errorData.error?.message || 'Error desconocido'}`);
        }

        const itemResult = await itemResponse.json();
        itemsCreados.push(itemResult.records[0].id);
      }
    }

    // Paso 2: Crear la solicitud de compra principal
    const solicitudRecord: AirtableRecord = {
      fields: {
        [COMPRAS_FIELDS.AREA_CORRESPONDIENTE]: data.areaSolicitante,
        [COMPRAS_FIELDS.NOMBRE_SOLICITANTE]: data.nombreSolicitante,
        [COMPRAS_FIELDS.CARGO_SOLICITANTE]: data.cargoSolicitante,
        [COMPRAS_FIELDS.HAS_PROVIDER]: data.hasProvider,
        [COMPRAS_FIELDS.VALOR_UVT]: valorUVT,
        [COMPRAS_FIELDS.ESTADO_SOLICITUD]: 'Pendiente',
        [COMPRAS_FIELDS.PRIORIDAD_SOLICITUD]: data.prioridadSolicitud
      }
    };

    // MIGRACIÓN COMPLETADA: Eliminado campo enlazado 'Equipo Financiero'
    // El campo 'Equipo Financiero' apuntaba a la tabla legacy (Equipo Financiero)
    // pero el JWT ahora contiene recordId de la tabla Personal de Nómina Core.
    // Como son bases diferentes, no se puede mantener el campo enlazado.
    // La información del usuario ya está en los campos planos:
    // - Nombre Solicitante
    // - Cargo Solicitante
    // - Area Correspondiente
    // Estos campos son suficientes para filtrado y auditoría.

    // SOLO AGREGAR ITEMS SI EXISTEN
    if (itemsCreados.length > 0) {
      solicitudRecord.fields[COMPRAS_FIELDS.ITEMS_LINK] = itemsCreados;
    }

    // Agregar campos opcionales
    if (data.descripcionTranscripcion) {
      solicitudRecord.fields[COMPRAS_FIELDS.DESCRIPCION_TRANSCRIPCION] = data.descripcionTranscripcion;
    }

    // Nota: 'Descripcion Solicitud IAInterpretacion' parece ser un campo computado en Airtable
    // No se debe asignar directamente para evitar errores de "cannot accept the provided value"
    // if (data.descripcionIAInterpretacion) {
    //   solicitudRecord.fields['Descripcion Solicitud IAInterpretacion'] = data.descripcionIAInterpretacion;
    // }

    if (data.razonSocialProveedor) {
      solicitudRecord.fields[COMPRAS_FIELDS.RAZON_SOCIAL_PROVEEDOR] = data.razonSocialProveedor;
    }

    if (data.cotizacionDoc) {
      // Si es una URL de S3, guardarla directamente
      if (data.cotizacionDoc.startsWith('https://')) {
        solicitudRecord.fields[COMPRAS_FIELDS.COTIZACION_DOC] = data.cotizacionDoc;
      } else {
        try {
          const attachmentData = JSON.parse(data.cotizacionDoc);
          solicitudRecord.fields[COMPRAS_FIELDS.COTIZACION_DOC] = attachmentData;
        } catch (error) {
          console.error('Error parsing cotization document:', error);
          // Si no es JSON válido, guardarlo como texto
          solicitudRecord.fields[COMPRAS_FIELDS.COTIZACION_DOC] = data.cotizacionDoc;
        }
      }
    }

    const solicitudResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${comprasTableId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ records: [solicitudRecord] })
      }
    );

    if (!solicitudResponse.ok) {
      const errorData = await solicitudResponse.json();
      console.error('Error creating solicitud:', errorData);
      
      // Si falló la creación de la solicitud, intentar limpiar los items creados (solo si hay items)
      if (itemsCreados.length > 0) {
        try {
          const deletePromises = itemsCreados.map(itemId =>
            fetch(`https://api.airtable.com/v0/${baseId}/${itemsTableId}/${itemId}`, {
              method: 'DELETE',
              headers
            })
          );
          await Promise.all(deletePromises);
          console.log('Items limpiados después del error');
        } catch (cleanupError) {
          console.error('Error limpiando items:', cleanupError);
        }
      }

      throw new Error(`Error al crear solicitud: ${errorData.error?.message || 'Error desconocido'}`);
    }

    const solicitudResult = await solicitudResponse.json();

    // Paso 3: Actualizar los items para vincularlos con la solicitud creada (solo si hay items)
    const solicitudId = solicitudResult.records[0].id;
    
    if (itemsCreados.length > 0) {
      const updatePromises = itemsCreados.map(itemId => {
        return fetch(`https://api.airtable.com/v0/${baseId}/${itemsTableId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{
              id: itemId,
              fields: {
                [ITEMS_COMPRAS_FIELDS.COMPRA_Y_ADQUISICION]: [solicitudId]
              }
            }]
          })
        });
      });

      await Promise.all(updatePromises);
    }

    console.log(`Solicitud de compra creada exitosamente: ${solicitudId} con ${itemsCreados.length} items`);

    // Generar PDF de la solicitud
    let pdfUrl = null;
    try {
      // Obtener la URL base del servidor (para desarrollo local)
      const baseUrl = 'http://localhost:3000'; // URL fija para desarrollo
      
      console.log('🔥 Intentando generar PDF usando URL:', `${baseUrl}/api/generate-pdf`);
      
      const pdfResponse = await fetch(`${baseUrl}/api/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            solicitudData: data,
            solicitudId: solicitudId
          })
      });

      if (pdfResponse.ok) {
        const pdfResult = await pdfResponse.json();
        console.log('Respuesta del API de PDF:', pdfResult);
        if (pdfResult.success) {
          pdfUrl = pdfResult.pdfUrl;
          console.log('PDF generado exitosamente:', pdfUrl);
          
          // Actualizar el registro de Airtable con el URL del PDF
          try {
            console.log('Actualizando registro de Airtable con PDF URL...');
            const updateResponse = await fetch(
              `https://api.airtable.com/v0/${baseId}/${comprasTableId}/${solicitudId}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fields: {
                    'Documento Solicitud': pdfUrl
                  }
                })
              }
            );

            if (updateResponse.ok) {
              console.log('✅ Registro de Airtable actualizado con el URL del PDF');
            } else {
              const updateError = await updateResponse.json();
              console.error('❌ Error actualizando registro con PDF URL:', updateError);
            }
          } catch (updateError) {
            console.error('❌ Error actualizando registro con PDF URL:', updateError);
          }
        } else {
          console.error('❌ Error en la generación de PDF:', pdfResult);
        }
      } else {
        const errorResponse = await pdfResponse.text();
        console.error('❌ Error en la respuesta del API de PDF:', errorResponse);
        console.warn('No se pudo generar el PDF, pero la solicitud fue creada exitosamente');
      }
    } catch (pdfError) {
      console.warn('Error generando PDF (solicitud creada exitosamente):', pdfError);
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud de compra registrada exitosamente',
      data: {
        solicitudId: solicitudId,
        itemsCreados: itemsCreados.length,
        valorTotal: data.items.reduce((total, item) => total + (item.valorItem * item.cantidad), 0),
        pdfUrl: pdfUrl,
        pdfGenerated: !!pdfUrl
      }
    });

  } catch (error) {
    console.error('Error procesando solicitud de compra:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
        success: false
      },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificar estado del servicio
export async function GET() {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    if (!apiKey || !baseId) {
      return NextResponse.json(
        { error: 'Configuración incompleta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Servicio de solicitudes de compra operativo',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verificando estado del servicio:', error);
    return NextResponse.json(
      { error: 'Error verificando estado del servicio' },
      { status: 500 }
    );
  }
}
