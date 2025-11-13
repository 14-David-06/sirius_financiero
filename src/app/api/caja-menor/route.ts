import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { CAJA_MENOR_FIELDS, ITEMS_CAJA_MENOR_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

// IDs de tablas específicos (desde variables de entorno)
const CAJA_MENOR_TABLE_ID = process.env.CAJA_MENOR_TABLE_ID || '';
const ITEMS_CAJA_MENOR_TABLE_ID = process.env.ITEMS_CAJA_MENOR_TABLE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !CAJA_MENOR_TABLE_ID || !ITEMS_CAJA_MENOR_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas para Caja Menor');
      console.error('   - AIRTABLE_API_KEY:', !!AIRTABLE_API_KEY);
      console.error('   - AIRTABLE_BASE_ID:', !!AIRTABLE_BASE_ID);
      console.error('   - CAJA_MENOR_TABLE_ID:', !!CAJA_MENOR_TABLE_ID);
      console.error('   - ITEMS_CAJA_MENOR_TABLE_ID:', !!ITEMS_CAJA_MENOR_TABLE_ID);
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🔄 API /caja-menor iniciando...');
    console.log('🔑 API Key disponible:', !!AIRTABLE_API_KEY);
    console.log('🗄️ Base ID:', AIRTABLE_BASE_ID);
    console.log('📊 Caja Menor Table ID:', CAJA_MENOR_TABLE_ID);
    console.log('📊 Items Caja Menor Table ID:', ITEMS_CAJA_MENOR_TABLE_ID);

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '1000');
    const filterByFormula = searchParams.get('filterByFormula');

    // Primero obtener registros de Caja Menor
    const cajaMenorRecords: Record<string, unknown>[] = [];

    console.log('📡 Consultando tabla Caja Menor...');
    console.log('🔍 Máximo de registros:', maxRecords);
    if (filterByFormula) {
      console.log('🔍 Filtro aplicado:', filterByFormula);
    }

    await base(CAJA_MENOR_TABLE_ID).select({
      maxRecords,
      ...(filterByFormula && { filterByFormula }),
      sort: [
        { field: 'Fecha Anticipo', direction: 'desc' } // Usar nombre de campo
      ]
    }).eachPage((pageRecords, fetchNextPage) => {
      pageRecords.forEach(record => {
        // Airtable devuelve datos con NOMBRES de campos, no Field IDs
        cajaMenorRecords.push({
          id: record.id,
          fechaAnticipo: record.fields['Fecha Anticipo'], 
          beneficiario: record.fields['Beneficiario'], 
          nitCC: record.fields['Nit-CC'], 
          concepto: record.fields['Concepto Caja Menor'], 
          valor: record.fields['Valor Caja Menor'], 
          itemsCajaMenor: record.fields['Items Caja Menor'], 
          realizaRegistro: record.fields['Realiza Registro']
        });
      });
      fetchNextPage();
    });

    // Obtener también los items detallados si hay records con items
    const itemsRecords: Record<string, unknown>[] = [];
    
    console.log('📡 Consultando tabla Items Caja Menor...');
    await base(ITEMS_CAJA_MENOR_TABLE_ID).select({
      maxRecords: 5000, // Más items que registros principales
      sort: [
        { field: 'Fecha', direction: 'desc' } // Fecha
      ]
    }).eachPage((pageRecords, fetchNextPage) => {
      itemsRecords.push(...pageRecords.map(record => ({
        id: record.id,
        item: record.fields['Item'], // Auto Number
        fecha: record.fields['Fecha'], // Fecha
        beneficiario: record.fields['Beneficiario'], // Beneficiario
        nitCC: record.fields['Nit/CC'], // Nit/CC
        concepto: record.fields['Concepto'], // Concepto
        centroCosto: record.fields['Centro Costo'], // Centro Costo
        valor: record.fields['Valor'], // Valor
        realizaRegistro: record.fields['Realiza Registro'], // Realiza Registro
        cajaMenor: record.fields['Caja Menor'] // Caja Menor (links)
      })));
      fetchNextPage();
    });

    console.log('✅ Registros Caja Menor obtenidos:', cajaMenorRecords.length);
    console.log('✅ Items Caja Menor obtenidos:', itemsRecords.length);
    
    // Debug detallado de fechas para verificar comparación de mes actual
    if (cajaMenorRecords.length > 0) {
      const hoy = new Date();
      const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
      console.log('📅 Mes actual:', mesActual);
      console.log('📅 Registros de Caja Menor por mes:');
      cajaMenorRecords.forEach((record: any) => {
        const fechaRecord = record.fechaAnticipo?.substring(0, 7);
        console.log(`   ✓ ID: ${record.id}, Fecha: ${record.fechaAnticipo}, Mes: ${fechaRecord}, Beneficiario: ${record.beneficiario}, Valor: $${record.valor?.toLocaleString('es-CO')}, Coincide con mes actual: ${fechaRecord === mesActual ? '✅ SÍ' : '❌ NO'}`);
      });
    }

    return NextResponse.json({
      cajaMenor: cajaMenorRecords,
      items: itemsRecords,
      totalCajaMenor: cajaMenorRecords.length,
      totalItems: itemsRecords.length,
      success: true
    });

  } catch (error) {
    console.error('❌ Error en API /caja-menor:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido al obtener datos de caja menor',
      success: false
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !CAJA_MENOR_TABLE_ID || !ITEMS_CAJA_MENOR_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas para Caja Menor');
      console.error('   - AIRTABLE_API_KEY:', !!AIRTABLE_API_KEY);
      console.error('   - AIRTABLE_BASE_ID:', !!AIRTABLE_BASE_ID);
      console.error('   - CAJA_MENOR_TABLE_ID:', !!CAJA_MENOR_TABLE_ID);
      console.error('   - ITEMS_CAJA_MENOR_TABLE_ID:', !!ITEMS_CAJA_MENOR_TABLE_ID);
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const requestData = await request.json();
    console.log('📝 Datos recibidos:', requestData);

    // Detectar el tipo de operación
    if (requestData.type === 'cajaMenor') {
      // Crear solo registro de Caja Menor
      const data = requestData.data;
      console.log('📝 Creando registro de caja menor:', data);

      // Validar campos requeridos para caja menor
      const requiredFields = ['fechaAnticipo', 'beneficiario', 'concepto', 'valor'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json({
          error: `Faltan campos requeridos: ${missingFields.join(', ')}`,
          success: false
        }, { status: 400 });
      }

      // ⚠️ VALIDACIÓN CRÍTICA: Verificar que no exista ya una caja menor del mes actual
      const fechaSolicitud = new Date(data.fechaAnticipo);
      const mesActual = `${fechaSolicitud.getFullYear()}-${String(fechaSolicitud.getMonth() + 1).padStart(2, '0')}`;
      
      console.log('🔍 Verificando si existe caja menor para el mes:', mesActual);
      
      // Consultar registros del mes actual
      const registrosDelMes: any[] = [];
      await base(CAJA_MENOR_TABLE_ID).select({
        filterByFormula: `AND(YEAR({Fecha Anticipo}) = ${fechaSolicitud.getFullYear()}, MONTH({Fecha Anticipo}) = ${fechaSolicitud.getMonth() + 1})`,
        maxRecords: 10
      }).eachPage((pageRecords, fetchNextPage) => {
        registrosDelMes.push(...pageRecords);
        fetchNextPage();
      });

      if (registrosDelMes.length > 0) {
        const registroExistente = registrosDelMes[0];
        const beneficiario = registroExistente.fields['Beneficiario'] || 'Desconocido';
        const valor = registroExistente.fields['Valor Caja Menor'] || 0;
        
        console.log('❌ Ya existe una caja menor para este mes:', {
          id: registroExistente.id,
          beneficiario,
          valor,
          mes: mesActual
        });
        
        return NextResponse.json({
          error: `Ya existe una Caja Menor registrada para ${mesActual}. Solo se permite una caja menor por mes.`,
          success: false,
          existingRecord: {
            beneficiario,
            valor,
            mes: mesActual
          }
        }, { status: 409 }); // 409 Conflict
      }

      console.log('✅ No existe caja menor previa para este mes, procediendo a crear...');

      // Crear el registro en la tabla Caja Menor usando NOMBRES de campos
      const createdRecord = await base(CAJA_MENOR_TABLE_ID).create({
        'Fecha Anticipo': data.fechaAnticipo, // Fecha Anticipo
        'Beneficiario': data.beneficiario, // Beneficiario
        'Nit-CC': data.nitCC || '', // Nit-CC 
        'Concepto Caja Menor': data.concepto, // Concepto Caja Menor
        'Valor Caja Menor': parseFloat(data.valor), // Valor Caja Menor
        'Realiza Registro': data.realizaRegistro || '' // Realiza Registro
      });

      console.log('✅ Registro de caja menor creado exitosamente:', createdRecord.id);

      return NextResponse.json({
        success: true,
        message: 'Caja menor creada exitosamente',
        record: {
          id: createdRecord.id,
          fechaAnticipo: data.fechaAnticipo,
          beneficiario: data.beneficiario,
          concepto: data.concepto,
          valor: data.valor,
          realizaRegistro: data.realizaRegistro
        }
      });
    }

    // Detectar si es creación de un item individual
    if (requestData.type === 'item') {
      const data = requestData.data;
      console.log('📝 Creando item de caja menor:', data);

      // Validar campos requeridos para item
      const requiredFields = ['fecha', 'beneficiario', 'concepto', 'valor', 'cajaMenorId'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json({
          error: `Faltan campos requeridos: ${missingFields.join(', ')}`,
          success: false
        }, { status: 400 });
      }

      // Crear el item en la tabla Items Caja Menor usando NOMBRES de campos
      const createdItem = await base(ITEMS_CAJA_MENOR_TABLE_ID).create({
        'Fecha': data.fecha,
        'Beneficiario': data.beneficiario,
        'Nit/CC': data.nitCC || '',
        'Concepto': data.concepto,
        'Centro Costo': data.centroCosto || '',
        'Valor': parseFloat(data.valor),
        'Realiza Registro': data.realizaRegistro || '',
        'Caja Menor': [data.cajaMenorId] // Link al registro de caja menor
      });

      console.log('✅ Item creado exitosamente:', createdItem.id);

      return NextResponse.json({
        success: true,
        message: 'Item de caja menor creado exitosamente',
        item: {
          id: createdItem.id,
          fecha: data.fecha,
          beneficiario: data.beneficiario,
          nitCC: data.nitCC,
          concepto: data.concepto,
          centroCosto: data.centroCosto,
          valor: data.valor,
          realizaRegistro: data.realizaRegistro,
          cajaMenorId: data.cajaMenorId
        }
      });
    }

    // Si no es tipo cajaMenor, procesar como registro completo (código existente)
    const data = requestData;
    console.log('📝 Creando registro completo de caja menor con items:', data);

    // Validar campos requeridos para la tabla principal
    const requiredFields = ['fechaAnticipo', 'beneficiario', 'concepto', 'valor'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Faltan campos requeridos: ${missingFields.join(', ')}`,
        success: false
      }, { status: 400 });
    }

    // Crear el registro principal en la tabla Caja Menor usando NOMBRES de campos
    const createdRecord = await base(CAJA_MENOR_TABLE_ID).create({
      'Fecha Anticipo': data.fechaAnticipo, // Fecha Anticipo
      'Beneficiario': data.beneficiario, // Beneficiario
      'Nit-CC': data.nitCC || '', // Nit-CC
      'Concepto Caja Menor': data.concepto, // Concepto Caja Menor
      'Valor Caja Menor': parseFloat(data.valor), // Valor Caja Menor
      'Realiza Registro': data.realizaRegistro || '' // Realiza Registro
    });

    console.log('✅ Registro principal creado exitosamente:', createdRecord.id);

    // Si hay items, crearlos en la tabla Items Caja Menor
    const itemsCreados = [];
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const createdItem = await base(ITEMS_CAJA_MENOR_TABLE_ID).create({
          [ITEMS_CAJA_MENOR_FIELDS.FECHA]: item.fecha || data.fechaAnticipo,
          [ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO]: item.beneficiario || data.beneficiario,
          [ITEMS_CAJA_MENOR_FIELDS.NIT_CC]: item.nit || data.nitCC,
          [ITEMS_CAJA_MENOR_FIELDS.CONCEPTO]: item.concepto,
          [ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO]: item.centroCosto || '',
          [ITEMS_CAJA_MENOR_FIELDS.VALOR]: parseFloat(item.valor),
          [ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR]: [createdRecord.id]
        });
        itemsCreados.push(createdItem);
      }

      // Actualizar el registro principal con los links a los items
      if (itemsCreados.length > 0) {
        await base(CAJA_MENOR_TABLE_ID).update(createdRecord.id, {
          [CAJA_MENOR_FIELDS.ITEMS_CAJA_MENOR]: itemsCreados.map(item => item.id)
        });
      }
    }

    console.log('✅ Items creados exitosamente:', itemsCreados.length);

    return NextResponse.json({
      record: {
        id: createdRecord.id,
        ...createdRecord.fields
      },
      items: itemsCreados.map(item => ({
        id: item.id,
        ...item.fields
      })),
      success: true
    });

  } catch (error) {
    console.error('❌ Error al crear registro de caja menor:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido al crear registro',
      success: false
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const data = await request.json();
    const { id, table, ...updateData } = data;

    if (!id) {
      return NextResponse.json({
        error: 'ID del registro es requerido para actualización',
        success: false
      }, { status: 400 });
    }

    const tableId = table === 'items' ? ITEMS_CAJA_MENOR_TABLE_ID : CAJA_MENOR_TABLE_ID;
    console.log('📝 Actualizando registro en tabla:', table || 'caja-menor', 'ID:', id);

    let updatedRecord;

    if (table === 'items') {
      // Actualizar en tabla Items Caja Menor
      updatedRecord = await base(ITEMS_CAJA_MENOR_TABLE_ID).update(id, {
        ...(updateData.fecha && { [ITEMS_CAJA_MENOR_FIELDS.FECHA]: updateData.fecha }),
        ...(updateData.beneficiario && { [ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO]: updateData.beneficiario }),
        ...(updateData.nit && { [ITEMS_CAJA_MENOR_FIELDS.NIT_CC]: updateData.nit }),
        ...(updateData.concepto && { [ITEMS_CAJA_MENOR_FIELDS.CONCEPTO]: updateData.concepto }),
        ...(updateData.centroCosto !== undefined && { [ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO]: updateData.centroCosto }),
        ...(updateData.valor && { [ITEMS_CAJA_MENOR_FIELDS.VALOR]: parseFloat(updateData.valor) })
      });
    } else {
      // Actualizar en tabla principal Caja Menor
      updatedRecord = await base(CAJA_MENOR_TABLE_ID).update(id, {
        ...(updateData.fechaAnticipo && { [CAJA_MENOR_FIELDS.FECHA_ANTICIPO]: updateData.fechaAnticipo }),
        ...(updateData.beneficiario && { [CAJA_MENOR_FIELDS.BENEFICIARIO]: updateData.beneficiario }),
        ...(updateData.nitCC !== undefined && { [CAJA_MENOR_FIELDS.NIT_CC]: updateData.nitCC }),
        ...(updateData.concepto && { [CAJA_MENOR_FIELDS.CONCEPTO]: updateData.concepto }),
        ...(updateData.valor && { [CAJA_MENOR_FIELDS.VALOR]: parseFloat(updateData.valor) })
      });
    }

    console.log('✅ Registro actualizado exitosamente:', updatedRecord.id);

    return NextResponse.json({
      record: {
        id: updatedRecord.id,
        ...updatedRecord.fields
      },
      success: true
    });

  } catch (error) {
    console.error('❌ Error al actualizar registro de caja menor:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido al actualizar registro',
      success: false
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const table = searchParams.get('table');

    if (!id) {
      return NextResponse.json({
        error: 'ID del registro es requerido para eliminación',
        success: false
      }, { status: 400 });
    }

    const tableId = table === 'items' ? ITEMS_CAJA_MENOR_TABLE_ID : CAJA_MENOR_TABLE_ID;
    console.log('🗑️ Eliminando registro de tabla:', table || 'caja-menor', 'ID:', id);

    // Si eliminamos un registro principal, primero eliminar sus items
    if (table !== 'items') {
      try {
        // Buscar items relacionados mediante el campo de relación
        const relatedItems: string[] = [];
        await base(ITEMS_CAJA_MENOR_TABLE_ID).select({
          filterByFormula: `SEARCH("${id}", {${ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR}})`,
          fields: [ITEMS_CAJA_MENOR_FIELDS.ITEM]
        }).eachPage((records, fetchNextPage) => {
          relatedItems.push(...records.map(r => r.id));
          fetchNextPage();
        });

        // Eliminar items relacionados
        if (relatedItems.length > 0) {
          await base(ITEMS_CAJA_MENOR_TABLE_ID).destroy(relatedItems);
          console.log('✅ Items relacionados eliminados:', relatedItems.length);
        }
      } catch (error) {
        console.warn('⚠️ Error al eliminar items relacionados:', error);
      }
    }

    // Eliminar el registro principal o item
    await base(tableId).destroy(id);

    console.log('✅ Registro eliminado exitosamente:', id);

    return NextResponse.json({
      message: 'Registro eliminado exitosamente',
      success: true
    });

  } catch (error) {
    console.error('❌ Error al eliminar registro de caja menor:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar registro',
      success: false
    }, { status: 500 });
  }
}