import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;
const TABLE_ID = process.env.AIRTABLE_BITACORA_TABLE_ID; // Bitacora Financiera table ID

// Field IDs from environment variables for security
const FIELD_TRANSCRIPCION = process.env.AIRTABLE_FIELD_TRANSCRIPCION; // Transcripcion Nota Financiera
const FIELD_REALIZA_REGISTRO = process.env.AIRTABLE_FIELD_REALIZA_REGISTRO; // Realiza Registro
const FIELD_USUARIO_LINK = process.env.AIRTABLE_FIELD_USUARIO_LINK; // Usuario (link to Equipo Financiero)

export async function POST(request: NextRequest) {
  try {
    if (!BASE_ID || !API_KEY || !TABLE_ID || !FIELD_TRANSCRIPCION || !FIELD_REALIZA_REGISTRO || !FIELD_USUARIO_LINK) {
      console.error('Missing Airtable configuration:', { 
        BASE_ID: !!BASE_ID, 
        API_KEY: !!API_KEY, 
        TABLE_ID: !!TABLE_ID,
        FIELD_TRANSCRIPCION: !!FIELD_TRANSCRIPCION,
        FIELD_REALIZA_REGISTRO: !!FIELD_REALIZA_REGISTRO,
        FIELD_USUARIO_LINK: !!FIELD_USUARIO_LINK
      });
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { transcripcion, usuario, usuarioId } = await request.json();

    if (!transcripcion || !usuario) {
      return NextResponse.json(
        { error: 'Transcripción y usuario son requeridos' },
        { status: 400 }
      );
    }

    // Preparar los datos para Airtable
    const airtableData: {
      fields: {
        [key: string]: string | string[] | number;
      }
    } = {
      fields: {
        [FIELD_TRANSCRIPCION]: transcripcion, // Transcripcion Nota Financiera
        [FIELD_REALIZA_REGISTRO]: usuario, // Realiza Registro
      }
    };

    // Si tenemos el ID del usuario, agregarlo como link
    if (usuarioId) {
      airtableData.fields[FIELD_USUARIO_LINK] = [usuarioId]; // Usuario (link to Equipo Financiero)
    }

    console.log('Sending to Airtable:', {
      url: `${AIRTABLE_API_URL}/${BASE_ID}/${TABLE_ID}`,
      data: airtableData
    });

    const response = await fetch(`${AIRTABLE_API_URL}/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(airtableData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable API error:', response.status, errorText);
      
      return NextResponse.json(
        { 
          error: 'Error al guardar en Airtable',
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Airtable response:', result);

    return NextResponse.json({
      success: true,
      recordId: result.id,
      message: 'Nota de bitácora guardada exitosamente'
    });

  } catch (error) {
    console.error('Error in bitacora-audio API:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}