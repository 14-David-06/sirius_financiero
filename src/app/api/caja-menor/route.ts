import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CAJA_MENOR_FIELDS, ITEMS_CAJA_MENOR_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

// IDs de tablas específicos (desde variables de entorno)
const CAJA_MENOR_TABLE_ID = process.env.CAJA_MENOR_TABLE_ID || '';
const ITEMS_CAJA_MENOR_TABLE_ID = process.env.ITEMS_CAJA_MENOR_TABLE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Configurar cliente S3 para eliminación de archivos
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Función helper para verificar si una URL es de S3
function isS3Url(url: string): boolean {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    if (!bucketName) return false;

    const urlObj = new URL(url);
    
    // Verificar diferentes formatos de URL de S3
    return urlObj.hostname === `${bucketName}.s3.${region}.amazonaws.com` ||  // Formato con región
           urlObj.hostname === `${bucketName}.s3.amazonaws.com` ||            // Formato sin región
           (urlObj.hostname === 's3.amazonaws.com' && urlObj.pathname.startsWith(`/${bucketName}/`)); // Formato clásico
  } catch (error) {
    return false;
  }
}

// Función helper para extraer la key de S3 de una URL
function extractS3KeyFromUrl(url: string): string | null {
  try {
    // Solo procesar URLs de S3
    if (!isS3Url(url)) {
      return null;
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    if (!bucketName) return null;

    const urlObj = new URL(url);
    let key: string | null = null;
    
    // Formato específico de caja menor: https://bucket-name.s3.region.amazonaws.com/caja_menor/carpeta/archivo
    if (urlObj.hostname === `${bucketName}.s3.${region}.amazonaws.com`) {
      key = urlObj.pathname.substring(1); // Remover el "/" inicial
    }
    // Formato alternativo: https://bucket-name.s3.amazonaws.com/caja_menor/carpeta/archivo
    else if (urlObj.hostname === `${bucketName}.s3.amazonaws.com`) {
      key = urlObj.pathname.substring(1); // Remover el "/" inicial
    }
    // Si es formato https://s3.amazonaws.com/bucket-name/path/to/file
    else if (urlObj.hostname === 's3.amazonaws.com' && urlObj.pathname.startsWith(`/${bucketName}/`)) {
      key = urlObj.pathname.substring(`/${bucketName}/`.length);
    }

    if (key) {
      // Decodificar la key para manejar caracteres especiales correctamente
      const decodedKey = decodeURIComponent(key);
      console.log('🔑 Key original extraída:', key);
      console.log('🔑 Key decodificada final:', decodedKey);
      return decodedKey;
    }
    
    console.warn('⚠️ Formato de URL de S3 no reconocido:', url);
    return null;
  } catch (error) {
    console.warn('Error al extraer key de S3 de URL:', url, error);
    return null;
  }
}

// Función helper para eliminar archivo de S3
async function deleteFileFromS3(fileUrl: string): Promise<boolean> {
  try {
    console.log('🔍 Analizando URL para eliminación:', fileUrl);
    
    // Verificar si es una URL de S3
    if (!isS3Url(fileUrl)) {
      console.log('ℹ️ URL no es de S3 (probablemente Airtable), omitiendo eliminación:', fileUrl);
      return true; // No es error, simplemente no necesita eliminarse
    }

    console.log('✅ URL identificada como S3, procediendo con eliminación...');
    
    // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.error('❌ Faltan credenciales de AWS para eliminar archivo');
      return false;
    }

    const s3Key = extractS3KeyFromUrl(fileUrl);
    if (!s3Key) {
      console.error('❌ No se pudo extraer la key de S3 de la URL:', fileUrl);
      return false;
    }

    // Validar que la key parece correcta (debe empezar con caja_menor/)
    if (!s3Key.startsWith('caja_menor/')) {
      console.error('❌ Key de S3 no parece válida para caja menor:', s3Key);
      return false;
    }

    console.log('🪣 Bucket de destino:', process.env.AWS_S3_BUCKET);
    console.log('🔑 Key que será eliminada:', s3Key);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key
    });

    console.log('🗑️ Ejecutando comando de eliminación en S3...');
    const result = await s3Client.send(deleteCommand);
    
    console.log('✅ Respuesta de eliminación S3:', result);
    
    // Verificar si realmente se eliminó (status 204 indica éxito)
    if (result.$metadata?.httpStatusCode === 204) {
      console.log('🎯 Archivo eliminado exitosamente de S3:', s3Key);
      return true;
    } else {
      console.warn('⚠️ Respuesta inesperada de S3:', result.$metadata?.httpStatusCode);
      return false;
    }
  } catch (error) {
    console.error('❌ Error al eliminar archivo de S3:', error);
    console.error('❌ URL problemática:', fileUrl);
    return false;
  }
}

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
        { field: CAJA_MENOR_FIELDS.FECHA_ANTICIPO, direction: 'desc' }
      ]
    }).eachPage((pageRecords, fetchNextPage) => {
      pageRecords.forEach(record => {
        // Airtable devuelve datos con NOMBRES de campos, no Field IDs
        cajaMenorRecords.push({
          id: record.id,
          fechaAnticipo: record.fields[CAJA_MENOR_FIELDS.FECHA_ANTICIPO], 
          beneficiario: record.fields[CAJA_MENOR_FIELDS.BENEFICIARIO], 
          nitCC: record.fields[CAJA_MENOR_FIELDS.NIT_CC], 
          concepto: record.fields[CAJA_MENOR_FIELDS.CONCEPTO], 
          valor: record.fields[CAJA_MENOR_FIELDS.VALOR], 
          itemsCajaMenor: record.fields[CAJA_MENOR_FIELDS.ITEMS_CAJA_MENOR], 
          realizaRegistro: record.fields[CAJA_MENOR_FIELDS.REALIZA_REGISTRO],
          fechaConsolidacion: record.fields[CAJA_MENOR_FIELDS.FECHA_CONSOLIDACION],
          documentoConsolidacion: record.fields[CAJA_MENOR_FIELDS.DOCUMENTO_CONSOLIDACION],
          estadoCajaMenor: record.fields[CAJA_MENOR_FIELDS.ESTADO_CAJA_MENOR]
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
        { field: ITEMS_CAJA_MENOR_FIELDS.FECHA, direction: 'desc' }
      ]
    }).eachPage((pageRecords, fetchNextPage) => {
      itemsRecords.push(...pageRecords.map(record => ({
        id: record.id,
        item: record.fields[ITEMS_CAJA_MENOR_FIELDS.ITEM],
        fecha: record.fields[ITEMS_CAJA_MENOR_FIELDS.FECHA],
        beneficiario: record.fields[ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO],
        nitCC: record.fields[ITEMS_CAJA_MENOR_FIELDS.NIT_CC],
        concepto: record.fields[ITEMS_CAJA_MENOR_FIELDS.CONCEPTO],
        centroCosto: record.fields[ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO],
        valor: record.fields[ITEMS_CAJA_MENOR_FIELDS.VALOR],
        realizaRegistro: record.fields[ITEMS_CAJA_MENOR_FIELDS.REALIZA_REGISTRO],
        cajaMenor: record.fields[ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR],
        comprobante: record.fields[ITEMS_CAJA_MENOR_FIELDS.COMPROBANTE]
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

      console.log('✅ Campos validados, procediendo a crear caja menor...');

      // Crear el registro en la tabla Caja Menor usando NOMBRES de campos
      const createdRecord = await base(CAJA_MENOR_TABLE_ID).create({
        [CAJA_MENOR_FIELDS.FECHA_ANTICIPO]: data.fechaAnticipo,
        [CAJA_MENOR_FIELDS.BENEFICIARIO]: data.beneficiario,
        [CAJA_MENOR_FIELDS.NIT_CC]: data.nitCC || '',
        [CAJA_MENOR_FIELDS.CONCEPTO]: data.concepto,
        [CAJA_MENOR_FIELDS.VALOR]: parseFloat(data.valor),
        [CAJA_MENOR_FIELDS.REALIZA_REGISTRO]: data.realizaRegistro || ''
      });

      console.log('✅ Registro de caja menor creado exitosamente:', (createdRecord as any).id);

      return NextResponse.json({
        success: true,
        message: 'Caja menor creada exitosamente',
        cajaMenor: {
          id: (createdRecord as any).id,
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

      // Crear el item en la tabla Items Caja Menor
      const itemFields: any = {
        [ITEMS_CAJA_MENOR_FIELDS.FECHA]: data.fecha,
        [ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO]: data.beneficiario,
        [ITEMS_CAJA_MENOR_FIELDS.NIT_CC]: data.nitCC || '',
        [ITEMS_CAJA_MENOR_FIELDS.CONCEPTO]: data.concepto,
        [ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO]: data.centroCosto || '',
        [ITEMS_CAJA_MENOR_FIELDS.VALOR]: parseFloat(data.valor),
        [ITEMS_CAJA_MENOR_FIELDS.REALIZA_REGISTRO]: data.realizaRegistro || '',
        [ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR]: [data.cajaMenorId]
      };

      // Agregar comprobante si existe (formato Airtable Attachment)
      if (data.comprobanteUrl) {
        itemFields[ITEMS_CAJA_MENOR_FIELDS.COMPROBANTE] = [{ url: data.comprobanteUrl }];
        itemFields[ITEMS_CAJA_MENOR_FIELDS.URL_S3] = data.comprobanteUrl;
        console.log('📎 Adjuntando comprobante:', data.comprobanteUrl);
        console.log('🔗 Guardando URL S3 original en campo "URL S3":', data.comprobanteUrl);
        
        // Verificar la key que se extraería de esta URL
        const testKey = extractS3KeyFromUrl(data.comprobanteUrl);
        console.log('🧪 Key que se extraería para eliminación:', testKey);
      }

      const createdItem = await base(ITEMS_CAJA_MENOR_TABLE_ID).create(itemFields);

      console.log('✅ Item creado exitosamente:', (createdItem as any).id);

      return NextResponse.json({
        success: true,
        message: 'Item de caja menor creado exitosamente',
        item: {
          id: (createdItem as any).id,
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
      [CAJA_MENOR_FIELDS.FECHA_ANTICIPO]: data.fechaAnticipo,
      [CAJA_MENOR_FIELDS.BENEFICIARIO]: data.beneficiario,
      [CAJA_MENOR_FIELDS.NIT_CC]: data.nitCC || '',
      [CAJA_MENOR_FIELDS.CONCEPTO]: data.concepto,
      [CAJA_MENOR_FIELDS.VALOR]: parseFloat(data.valor),
      [CAJA_MENOR_FIELDS.REALIZA_REGISTRO]: data.realizaRegistro || ''
    });

    console.log('✅ Registro principal creado exitosamente:', (createdRecord as any).id);

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
          [ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR]: [(createdRecord as any).id]
        });
        itemsCreados.push(createdItem);
      }

      // Actualizar el registro principal con los links a los items
      if (itemsCreados.length > 0) {
        await base(CAJA_MENOR_TABLE_ID).update((createdRecord as any).id, {
          [CAJA_MENOR_FIELDS.ITEMS_CAJA_MENOR]: itemsCreados.map(item => (item as any).id)
        });
      }
    }

    console.log('✅ Items creados exitosamente:', itemsCreados.length);

    return NextResponse.json({
      record: {
        id: (createdRecord as any).id,
        ...createdRecord.fields
      },
      items: itemsCreados.map(item => ({
        id: (item as any).id,
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

    // Función helper para manejar la actualización de documentos
    const handleDocumentUpdate = async (currentRecord: any, newDocumentData: any, isItemTable: boolean) => {
      if (!newDocumentData) return; // No hay nuevo documento

      // Obtener la URL S3 original del campo correspondiente
      const urlS3Field = isItemTable ? ITEMS_CAJA_MENOR_FIELDS.URL_S3 : CAJA_MENOR_FIELDS.URL_S3;
      const currentS3Url = currentRecord.fields[urlS3Field];
      
      console.log('🔍 Verificando actualización de documento:');
      console.log('📄 Tabla:', isItemTable ? 'Items' : 'Caja Menor Principal');
      console.log('📄 URL S3 actual:', currentS3Url);
      console.log('📄 Nuevo documento:', newDocumentData);
      
      // Si hay URL S3 actual, eliminar archivo de S3
      if (currentS3Url && typeof currentS3Url === 'string') {
        console.log('🗑️ Eliminando archivo anterior de S3 usando URL original:', currentS3Url);
        const deleted = await deleteFileFromS3(currentS3Url);
        if (deleted) {
          console.log('✅ Archivo anterior eliminado exitosamente de S3');
        } else {
          console.warn('⚠️ No se pudo eliminar el archivo anterior de S3:', currentS3Url);
        }
      } else {
        console.log('📄 No hay URL S3 para eliminar archivo anterior');
      }
    };

    // Obtener el registro actual para comparar documentos
    let currentRecord;
    try {
      currentRecord = await base(tableId).find(id);
    } catch (error) {
      return NextResponse.json({
        error: 'Registro no encontrado',
        success: false
      }, { status: 404 });
    }

    let updatedRecord;

    if (table === 'items') {
      // Manejar actualización de documento en items
      console.log('🔄 Procesando actualización de item...');
      if (updateData.comprobante) {
        console.log('📄 Se detectó nuevo comprobante, procesando eliminación del anterior...');
        await handleDocumentUpdate(currentRecord, updateData.comprobante, true);
      } else {
        console.log('📄 No hay nuevo comprobante para actualizar');
      }

      // Actualizar en tabla Items Caja Menor
      const updateFields: any = {};
      
      if (updateData.fecha) updateFields[ITEMS_CAJA_MENOR_FIELDS.FECHA] = updateData.fecha;
      if (updateData.beneficiario) updateFields[ITEMS_CAJA_MENOR_FIELDS.BENEFICIARIO] = updateData.beneficiario;
      if (updateData.nitCC !== undefined) updateFields[ITEMS_CAJA_MENOR_FIELDS.NIT_CC] = updateData.nitCC;
      if (updateData.concepto) updateFields[ITEMS_CAJA_MENOR_FIELDS.CONCEPTO] = updateData.concepto;
      if (updateData.centroCosto !== undefined) updateFields[ITEMS_CAJA_MENOR_FIELDS.CENTRO_COSTO] = updateData.centroCosto;
      if (updateData.valor) updateFields[ITEMS_CAJA_MENOR_FIELDS.VALOR] = parseFloat(updateData.valor);
      if (updateData.realizaRegistro) updateFields[ITEMS_CAJA_MENOR_FIELDS.REALIZA_REGISTRO] = updateData.realizaRegistro;
      if (updateData.cajaMenor) updateFields[ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR] = updateData.cajaMenor;
      if (updateData.comprobante) updateFields[ITEMS_CAJA_MENOR_FIELDS.COMPROBANTE] = updateData.comprobante;
      if (updateData.urlS3) updateFields[ITEMS_CAJA_MENOR_FIELDS.URL_S3] = updateData.urlS3;
      if (updateData.urlS3) updateFields[ITEMS_CAJA_MENOR_FIELDS.URL_S3] = updateData.urlS3;
      
      updatedRecord = await base(ITEMS_CAJA_MENOR_TABLE_ID).update(id, updateFields);
    } else {
      // Manejar actualización de documento en caja menor principal
      console.log('🔄 Procesando actualización de caja menor principal...');
      if (updateData.documentoConsolidacion) {
        console.log('📄 Se detectó nuevo documento de consolidación, procesando eliminación del anterior...');
        await handleDocumentUpdate(currentRecord, updateData.documentoConsolidacion, false);
      } else {
        console.log('📄 No hay nuevo documento de consolidación para actualizar');
      }

      // Actualizar en tabla principal Caja Menor
      const updateFields: any = {};
      
      if (updateData.fechaAnticipo) updateFields[CAJA_MENOR_FIELDS.FECHA_ANTICIPO] = updateData.fechaAnticipo;
      if (updateData.beneficiario) updateFields[CAJA_MENOR_FIELDS.BENEFICIARIO] = updateData.beneficiario;
      if (updateData.nitCC !== undefined) updateFields[CAJA_MENOR_FIELDS.NIT_CC] = updateData.nitCC;
      if (updateData.concepto) updateFields[CAJA_MENOR_FIELDS.CONCEPTO] = updateData.concepto;
      if (updateData.valor) updateFields[CAJA_MENOR_FIELDS.VALOR] = parseFloat(updateData.valor);
      if (updateData.realizaRegistro) updateFields[CAJA_MENOR_FIELDS.REALIZA_REGISTRO] = updateData.realizaRegistro;
      if (updateData.fechaConsolidacion !== undefined) updateFields[CAJA_MENOR_FIELDS.FECHA_CONSOLIDACION] = updateData.fechaConsolidacion;
      if (updateData.documentoConsolidacion) updateFields[CAJA_MENOR_FIELDS.DOCUMENTO_CONSOLIDACION] = updateData.documentoConsolidacion;
      if (updateData.urlS3) updateFields[CAJA_MENOR_FIELDS.URL_S3] = updateData.urlS3;
      if (updateData.urlS3) updateFields[CAJA_MENOR_FIELDS.URL_S3] = updateData.urlS3;
      
      updatedRecord = await base(CAJA_MENOR_TABLE_ID).update(id, updateFields);
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

    // Función helper para obtener URLs de documentos y eliminarlos de S3
    const deleteDocumentsFromRecord = async (recordId: string, isItemTable: boolean) => {
      try {
        const record = await base(isItemTable ? ITEMS_CAJA_MENOR_TABLE_ID : CAJA_MENOR_TABLE_ID).find(recordId);
        


        // Obtener la URL S3 original del campo correspondiente
        const urlS3Field = isItemTable ? ITEMS_CAJA_MENOR_FIELDS.URL_S3 : CAJA_MENOR_FIELDS.URL_S3;
        const s3Url = record.fields[urlS3Field];

        if (s3Url && typeof s3Url === 'string') {
          console.log('🗑️ Eliminando archivo de S3 usando URL original:', s3Url);
          const deleted = await deleteFileFromS3(s3Url);
          if (deleted) {
            console.log('✅ Documento eliminado de S3:', s3Url);
          } else {
            console.warn('⚠️ No se pudo eliminar el documento de S3:', s3Url);
          }
        } else {
          console.log('ℹ️ No hay URL S3 para eliminar en registro:', recordId);
        }
      } catch (error) {
        console.warn('⚠️ Error al eliminar documento de S3 para registro:', recordId, error);
      }
    };

    // Si eliminamos un registro principal, primero eliminar documentos de sus items
    if (table !== 'items') {
      try {
        // Buscar items relacionados con sus documentos
        const relatedItemsData: Array<{id: string}> = [];
        await base(ITEMS_CAJA_MENOR_TABLE_ID).select({
          filterByFormula: `SEARCH("${id}", {${ITEMS_CAJA_MENOR_FIELDS.CAJA_MENOR}})`,
          fields: [ITEMS_CAJA_MENOR_FIELDS.ITEM, ITEMS_CAJA_MENOR_FIELDS.COMPROBANTE]
        }).eachPage((records, fetchNextPage) => {
          relatedItemsData.push(...records.map(r => ({ id: r.id })));
          fetchNextPage();
        });

        // Eliminar documentos de items relacionados
        for (const item of relatedItemsData) {
          await deleteDocumentsFromRecord(item.id, true);
        }

        // Eliminar items relacionados de Airtable
        if (relatedItemsData.length > 0) {
          await base(ITEMS_CAJA_MENOR_TABLE_ID).destroy(relatedItemsData.map(item => item.id));
          console.log('✅ Items relacionados eliminados:', relatedItemsData.length);
        }

        // Eliminar documento del registro principal
        await deleteDocumentsFromRecord(id, false);

      } catch (error) {
        console.warn('⚠️ Error al eliminar items relacionados:', error);
      }
    } else {
      // Si es un item individual, eliminar su documento
      await deleteDocumentsFromRecord(id, true);
    }

    // Eliminar el registro principal o item de Airtable
    await base(tableId).destroy(id);

    console.log('✅ Registro y documentos eliminados exitosamente:', id);

    return NextResponse.json({
      message: 'Registro y documentos eliminados exitosamente',
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