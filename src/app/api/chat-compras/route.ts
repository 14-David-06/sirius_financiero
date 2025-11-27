import { NextRequest, NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/security/validation';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const CONVERSACIONES_TABLE_ID = process.env.AIRTABLE_CONVERSACIONES_TABLE_ID;

interface MensajeChat {
  id: string;
  fields: {
    'ID Conversacion': number;
    'Fecha/Hora Mensaje': string;
    'Remitente': 'Solicitante' | 'Administrador de Compras';
    'Nombre Remitente': string;
    'Mensaje': string;
    'Realiza Registro'?: string;
    'Solicitud de Compra': string[];
  };
}

// GET - Obtener mensajes de una conversación específica
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const compraId = searchParams.get('compraId');

    if (!compraId) {
      return NextResponse.json(
        { error: 'ID de compra requerido' },
        { status: 400 }
      );
    }

    // Sanitizar input
    const sanitizedCompraId = sanitizeInput(compraId);

    // Verificar que las variables de entorno estén configuradas
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !CONVERSACIONES_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable incompleta' },
        { status: 500 }
      );
    }

    // Construir URL de Airtable con filtro
    const filterFormula = encodeURIComponent(`{Solicitud de Compra} = '${sanitizedCompraId}'`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CONVERSACIONES_TABLE_ID}?filterByFormula=${filterFormula}&sort[0][field]=Fecha/Hora Mensaje&sort[0][direction]=asc`;

    console.log('Chat API - GET', `Obteniendo mensajes para compra: ${sanitizedCompraId}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // No cache para datos en tiempo real
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chat API - Error', `Error de Airtable: ${response.status} - ${errorText}`);

      // Si la tabla no existe, devolver array vacío en lugar de error
      if (response.status === 404) {
        console.log('Tabla no encontrada, devolviendo array vacío');
        return NextResponse.json({ mensajes: [] });
      }

      throw new Error(`Error al obtener mensajes: ${response.status}`);
    }

    const data = await response.json();

    // Transformar datos de Airtable al formato esperado
    const mensajes = data.records.map((record: MensajeChat) => ({
      id: record.id,
      idConversacion: record.fields['ID Conversacion'],
      fechaHoraMensaje: record.fields['Fecha/Hora Mensaje'],
      remitente: record.fields['Remitente'],
      nombreRemitente: record.fields['Nombre Remitente'],
      mensaje: record.fields['Mensaje'],
      realizaRegistro: record.fields['Realiza Registro'],
      solicitudCompra: record.fields['Solicitud de Compra']
    }));

    console.log(`Encontrados ${mensajes.length} mensajes para la compra ${sanitizedCompraId}`);
    return NextResponse.json({ mensajes });

  } catch (error) {
    console.error('Error en chat API GET:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Enviar un nuevo mensaje
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { compraId, mensaje, nombreRemitente, remitente, realizaRegistro } = body;

    // Validar campos requeridos
    if (!compraId || !mensaje || !nombreRemitente || !remitente) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Validar remitente
    if (!['Solicitante', 'Administrador de Compras'].includes(remitente)) {
      return NextResponse.json(
        { error: 'Remitente inválido' },
        { status: 400 }
      );
    }

    // Verificar que las variables de entorno estén configuradas
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !CONVERSACIONES_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable incompleta' },
        { status: 500 }
      );
    }

    // Sanitizar inputs
    const sanitizedCompraId = sanitizeInput(compraId);
    const sanitizedMensaje = sanitizeInput(mensaje);
    const sanitizedNombreRemitente = sanitizeInput(nombreRemitente);
    const sanitizedRealizaRegistro = realizaRegistro ? sanitizeInput(realizaRegistro) : sanitizedNombreRemitente;

    // Preparar datos para Airtable
    const recordData = {
      fields: {
        'Remitente': remitente,
        'Nombre Remitente': sanitizedNombreRemitente,
        'Mensaje': sanitizedMensaje,
        'Solicitud de Compra': [sanitizedCompraId],
        'Realiza Registro': sanitizedRealizaRegistro
      }
    };

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CONVERSACIONES_TABLE_ID}`;

    console.log('Chat API - POST', `Enviando mensaje para compra: ${sanitizedCompraId} por ${sanitizedNombreRemitente}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chat API - Error', `Error de Airtable: ${response.status} - ${errorText}`);

      // Si la tabla no existe, devolver error específico
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Tabla de conversaciones no encontrada. Verifica la configuración de Airtable.' },
          { status: 404 }
        );
      }

      throw new Error(`Error al enviar mensaje: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      recordId: result.id
    });

  } catch (error) {
    console.error('Error en chat API POST:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}