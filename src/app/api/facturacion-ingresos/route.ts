import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const TABLE_ID = process.env.AIRTABLE_MOVIMIENTOS_TABLE_ID; // Usar tabla de movimientos bancarios

interface AirtableRecord {
  id: string;
  fields: {
    [key: string]: unknown;
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !TABLE_ID) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuración de Airtable no encontrada' 
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const año = searchParams.get('año');
    const mes = searchParams.get('mes');

    // Construir filtros para Airtable - replicar configuración del gráfico de barras
    let filterFormula = '';
    
    // Filtro base: solo registros con Centro de Resultados específicos
    const centrosPermitidos = [
      'Biochar Blend',
      'Biológicos General', 
      'Biochar Puro',
      'Biochar Como Filtro'
    ];
    
    const centrosFilter = `OR(${centrosPermitidos.map(centro => 
      `{Centro de Resultados (Solo Ingresos)} = "${centro}"`
    ).join(', ')})`;
    
    if (año) {
      filterFormula = `AND(${centrosFilter}, {Año formulado} = ${año})`;
      
      if (mes) {
        filterFormula = `AND(${centrosFilter}, {Año formulado} = ${año}, {Mes formulado} = ${mes})`;
      }
    } else {
      filterFormula = centrosFilter;
    }

    console.log(`API Facturación - Filtros: año=${año}, mes=${mes}`);
    console.log(`API Facturación - Formula: ${filterFormula}`);

    // Construir URL de Airtable
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`;
    let url = baseUrl + '?maxRecords=1000&sort[0][field]=Creada&sort[0][direction]=desc';
    
    if (filterFormula) {
      url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    }

    console.log(`API Facturación - URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`API Facturación - Total registros obtenidos: ${result.records?.length || 0}`);

    // Mapear los registros de forma simple
    const records = result.records?.map((record: AirtableRecord) => ({
      id: record.id,
      ...record.fields
    })) || [];

    // Filtrar solo los registros con Centro de Resultados válidos (por seguridad adicional)
    const centrosValidos = ['Biochar Blend', 'Biológicos General', 'Biochar Puro', 'Biochar Como Filtro'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facturacionRecords = records.filter((record: any) => {
      const centro = record['Centro de Resultados (Solo Ingresos)'];
      return centro && centrosValidos.includes(centro) && record['Valor'];
    });

    console.log(`API Facturación - Total registros obtenidos: ${records.length}`);
    console.log(`API Facturación - Registros de facturación válidos: ${facturacionRecords.length}`);
    
    // Agrupar por Centro de Resultados y sumar valores (replicar lógica del gráfico)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agrupados = facturacionRecords.reduce((acc: any, record: any) => {
      const centro = record['Centro de Resultados (Solo Ingresos)'];
      const valor = parseFloat(record['Valor']) || 0;
      
      if (!acc[centro]) {
        acc[centro] = {
          centro,
          totalValor: 0,
          count: 0,
          registros: []
        };
      }
      
      acc[centro].totalValor += valor;
      acc[centro].count += 1;
      acc[centro].registros.push(record);
      
      return acc;
    }, {});

    console.log(`API Facturación - Centros agrupados:`, Object.keys(agrupados));

    const uniqueRecords = facturacionRecords;

    console.log(`API Facturación - Registros únicos después de filtrar: ${uniqueRecords.length}`);

    return NextResponse.json({ 
      success: true, 
      data: uniqueRecords,
      agrupados: Object.values(agrupados), // Datos listos para el gráfico
      total: uniqueRecords.length
    });

  } catch (error) {
    console.error('Error fetching facturación ingresos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor al obtener facturación' 
      },
      { status: 500 }
    );
  }
}
