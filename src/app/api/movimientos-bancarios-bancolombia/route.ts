import { NextRequest, NextResponse } from 'next/server';
import { MOVIMIENTOS_BANCARIOS_FIELDS, BANCOLOMBIA_FIELDS } from '@/lib/config/airtable-fields';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const TABLE_ID = process.env.AIRTABLE_MOVIMIENTOS_TABLE_ID;

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
    const maxRecords = searchParams.get('maxRecords');
    const sortField = searchParams.get('sort[0][field]') || MOVIMIENTOS_BANCARIOS_FIELDS.FECHA;
    const sortDirection = searchParams.get('sort[0][direction]') || 'desc';

    // Construir filtros para Airtable
    let filterFormula = '';
    if (año) {
      filterFormula = `{${MOVIMIENTOS_BANCARIOS_FIELDS.ANO_FORMULADO}} = ${año}`;
    }
    if (mes) {
      const mesFormula = `{${MOVIMIENTOS_BANCARIOS_FIELDS.NUMERO_MES_FORMULADO}} = ${mes}`;
      filterFormula = filterFormula 
        ? `AND(${filterFormula}, ${mesFormula})`
        : mesFormula;
    }

    // Construir parámetros de consulta para Airtable
    const params = new URLSearchParams();
    
    if (filterFormula) {
      params.append('filterByFormula', filterFormula);
    }
    params.append('sort[0][field]', sortField);
    params.append('sort[0][direction]', sortDirection);
    
    // Agregar maxRecords si se especifica
    if (maxRecords) {
      params.append('maxRecords', maxRecords);
    }

    // Hacer la petición a Airtable
    let allRecords: AirtableRecord[] = [];
    let offset: string | undefined = undefined;
    const shouldPaginate = !maxRecords; // Solo paginar si no hay límite específico
    
    do {
      const currentParams = new URLSearchParams(params);
      if (offset) {
        currentParams.append('offset', offset);
      }
      
      const currentUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}?${currentParams.toString()}`;
      
      const response = await fetch(currentUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error de Airtable: ${response.status}`);
      }

      const airtableData = await response.json();
      allRecords = allRecords.concat(airtableData.records);
      offset = airtableData.offset;
      
      // Si se especificó maxRecords, no continuar la paginación
      if (!shouldPaginate) {
        break;
      }
      
    } while (offset);

    // Transformar datos de Airtable al formato esperado
    const movimientos = allRecords.map((record: AirtableRecord) => {
      const fields = record.fields;
      
      // Función helper para obtener valor de campo (maneja arrays y strings)
      const getFieldValue = (fieldName: string) => {
        const value = fields[fieldName];
        if (Array.isArray(value)) {
          return value[0] || '';
        }
        return value || '';
      };

      // Intentar múltiples posibles nombres de campos para GRUPO y CLASE
      const grupo = getFieldValue('GRUPO (de Facturacion Ingresos)') || 
                   getFieldValue('GRUPO PRUEBA') || 
                   getFieldValue('Grupo') || '';
                   
      const clase = getFieldValue('CLASE (de Facturacion Ingresos)') || 
                   getFieldValue('CLASE PRUEBA') || 
                   getFieldValue('Clase') || '';

      // Para el campo específico de la fórmula de costos, priorizamos GRUPO PRUEBA y CLASE PRUEBA
      const grupoPrueba = getFieldValue('GRUPO PRUEBA') || grupo;
      const clasePrueba = getFieldValue('CLASE PRUEBA') || clase;

      // Limpiar espacios en blanco y caracteres especiales
      const grupoPruebaLimpio = grupoPrueba ? grupoPrueba.toString().trim() : '';
      const clasePruebaLimpia = clasePrueba ? clasePrueba.toString().trim() : '';
      
      return {
        id: record.id,
        fecha: fields[BANCOLOMBIA_FIELDS.FECHA] || '',
        descripcion: fields[BANCOLOMBIA_FIELDS.DESCRIPCION] || '',
        clasificacion: fields[BANCOLOMBIA_FIELDS.CLASIFICACION] || '',
        valor: Number(fields[BANCOLOMBIA_FIELDS.VALOR]) || 0,
        saldoBancarioAnterior: Number(fields['Saldo_Bancario_Anterior']) || 0,
        saldoBancarioActual: Number(fields['Saldo_Bancario_Actual']) || 0,
        tipoMovimiento: fields['Tipo de Movimiento (Apoyo)'] || '',
        centroResultados: fields['Centro de Resultados (Solo Ingresos)'] || '',
        centroCostos: fields[BANCOLOMBIA_FIELDS.CENTRO_COSTOS] || '',
        unidadNegocio: fields['Unidad de Negocio 1'] || '',
        fijoVariable: fields[BANCOLOMBIA_FIELDS.FIJO_VARIABLE] || '',
        naturalezaContable: fields[BANCOLOMBIA_FIELDS.NATURALEZA_CONTABLE] || '',
        legalizada: fields[BANCOLOMBIA_FIELDS.LEGALIZACION] || '',
        afecta: fields[BANCOLOMBIA_FIELDS.AFECTA] || '',
        grupo,
        clase,
        grupoPrueba: grupoPruebaLimpio,
        clasePrueba: clasePruebaLimpia,
        cuenta: getFieldValue('CUENTA (de Facturacion Ingresos)') || 
               getFieldValue('CUENTA PRUEBA') || '',
        subCuenta: getFieldValue('SUB-CUENTA PRUEBA') || '',
      };
    });

    // Log para debugging - información sobre los registros obtenidos
    console.log(`API Movimientos Bancarios - Total registros obtenidos: ${movimientos.length}`);
    console.log(`API Movimientos Bancarios - Filtros aplicados: año=${año}, mes=${mes}`);
    
    // Debugging detallado de los primeros registros para verificar los campos
    if (movimientos.length > 0) {
      console.log('=== DEBUGGING CAMPOS AIRTABLE ===');
      console.log('Campos disponibles en el primer registro:', Object.keys(allRecords[0].fields));
      
      // Buscar campos que contengan "GRUPO" o "CLASE"
      const camposGrupo = Object.keys(allRecords[0].fields).filter(campo => 
        campo.toLowerCase().includes('grupo')
      );
      const camposClase = Object.keys(allRecords[0].fields).filter(campo => 
        campo.toLowerCase().includes('clase')
      );
      
      console.log('Campos que contienen "grupo":', camposGrupo);
      console.log('Campos que contienen "clase":', camposClase);
      
      // Mostrar valores únicos de GRUPO PRUEBA y CLASE PRUEBA
      const gruposPruebaUnicos = [...new Set(movimientos.map(mov => mov.grupoPrueba).filter(Boolean))];
      const clasesPruebaUnicas = [...new Set(movimientos.map(mov => mov.clasePrueba).filter(Boolean))];
      
      console.log('Valores únicos de GRUPO PRUEBA:', gruposPruebaUnicos);
      console.log('Valores únicos de CLASE PRUEBA:', clasesPruebaUnicas);
      
      console.log('Ejemplo de los primeros 3 registros:');
      movimientos.slice(0, 3).forEach((mov, index) => {
        console.log(`Registro ${index + 1}:`, {
          id: mov.id,
          fecha: mov.fecha,
          descripcion: typeof mov.descripcion === 'string' ? mov.descripcion.substring(0, 50) : mov.descripcion,
          valor: mov.valor,
          grupo: mov.grupo,
          clase: mov.clase,
          grupoPrueba: mov.grupoPrueba,
          clasePrueba: mov.clasePrueba,
          cuenta: mov.cuenta
        });
      });
    }
    
    // Contar registros por GRUPO y CLASE para validación
    const grupoClaseCount = movimientos.reduce((acc, mov) => {
      const key = `${mov.grupo}-${mov.clase}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Distribución por GRUPO-CLASE:', grupoClaseCount);

    // Contar específicamente los ingresos operacionales
    const ingresosOperacionales = movimientos.filter(mov => 
      mov.grupo === 'Ingreso' && mov.clase === 'Operacional'
    );
    console.log(`Registros de Ingresos Operacionales encontrados: ${ingresosOperacionales.length}`);
    
    // Contar específicamente los costos operacionales (GRUPO PRUEBA = "Costo" AND CLASE PRUEBA = "Operacional")
    const costosOperacionales = movimientos.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      return grupoLimpio === 'Costo' && claseLimpia === 'Operacional';
    });
    console.log(`Registros de Costos Operacionales encontrados: ${costosOperacionales.length}`);
    
    // Contar específicamente los gastos de administración (GRUPO PRUEBA = "Gasto" AND CLASE PRUEBA = "Administración")
    const gastosAdministracion = movimientos.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      // Filtro EXACTO: solo "Gasto" y "Administración", sin palabras adicionales
      return grupoLimpio === 'Gasto' && claseLimpia === 'Administración';
    });

    // Eliminar duplicados por ID para coincidir exactamente con Airtable
    const gastosAdministracionUnicos = gastosAdministracion.filter((mov, index, arr) => 
      arr.findIndex(m => m.id === mov.id) === index
    );
    console.log(`Registros de Gastos Administración encontrados: ${gastosAdministracionUnicos.length}`);
    console.log(`🎯 OBJETIVO AIRTABLE: 702 registros`);
    console.log(`📊 DIFERENCIA: ${gastosAdministracionUnicos.length - 702} registros`);
    
    // ANÁLISIS DETALLADO DE LA DISCREPANCIA
    console.log('=== ANÁLISIS DETALLADO GASTOS ADMINISTRACIÓN ===');
    
    // Verificar duplicados por ID
    const idsGastosAdmin = gastosAdministracion.map(mov => mov.id);
    const idsUnicosGastos = new Set(idsGastosAdmin);
    if (idsUnicosGastos.size !== gastosAdministracion.length) {
      console.log(`⚠️ DUPLICADOS DETECTADOS: ${gastosAdministracion.length - idsUnicosGastos.size} registros duplicados`);
      
      // Identificar duplicados específicos
      const conteoIds = idsGastosAdmin.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const duplicados = Object.entries(conteoIds).filter(([, count]) => count > 1);
      console.log('IDs duplicados:', duplicados);
      
      // Mostrar detalles de registros duplicados
      duplicados.forEach(([id, count]) => {
        const registrosDuplicados = gastosAdministracion.filter(mov => mov.id === id);
        console.log(`ID ${id} aparece ${count} veces:`, registrosDuplicados);
      });
    }
    
    // Verificar valores exactos de GRUPO PRUEBA y CLASE PRUEBA
    console.log('Verificación de valores exactos:');
    gastosAdministracion.forEach((mov, index) => {
      if (index < 10) { // Solo primeros 10 para no saturar logs
        console.log(`${index + 1}. ID: ${mov.id}`);
        console.log(`   GRUPO PRUEBA: "${mov.grupoPrueba}" (length: ${mov.grupoPrueba?.length || 0})`);
        console.log(`   CLASE PRUEBA: "${mov.clasePrueba}" (length: ${mov.clasePrueba?.length || 0})`);
        console.log(`   Descripción: "${typeof mov.descripcion === 'string' ? mov.descripcion.substring(0, 30) : mov.descripcion}..."`);
        console.log(`   Fecha: ${mov.fecha}`);
        console.log(`   ---`);
      }
    });
    
    // Verificar si hay espacios en blanco o caracteres especiales
    const gruposUnicosGastos = [...new Set(gastosAdministracion.map(mov => `"${mov.grupoPrueba}"`))];
    const clasesUnicasAdmin = [...new Set(gastosAdministracion.map(mov => `"${mov.clasePrueba}"`))];
    
    console.log('Valores únicos de GRUPO PRUEBA en gastos administración:', gruposUnicosGastos);
    console.log('Valores únicos de CLASE PRUEBA en gastos administración:', clasesUnicasAdmin);
    
    // Debugging detallado para encontrar la discrepancia
    console.log('=== ANÁLISIS DETALLADO DE COSTOS OPERACIONALES ===');
    console.log(`Total registros procesados: ${movimientos.length}`);
    
    // Contar todos los registros con GRUPO PRUEBA = "Costo"
    const todosCostos = movimientos.filter(mov => mov.grupoPrueba === 'Costo');
    console.log(`Registros con GRUPO PRUEBA = "Costo": ${todosCostos.length}`);
    
    // Contar todos los registros con CLASE PRUEBA = "Operacional"
    const todosOperacionales = movimientos.filter(mov => mov.clasePrueba === 'Operacional');
    console.log(`Registros con CLASE PRUEBA = "Operacional": ${todosOperacionales.length}`);
    
    // Mostrar los primeros 5 registros de costos operacionales con detalles completos
    console.log('Primeros 5 Costos Operacionales encontrados:');
    costosOperacionales.slice(0, 5).forEach((mov, index) => {
      console.log(`${index + 1}. ID: ${mov.id}, Fecha: ${mov.fecha}, Descripción: "${mov.descripcion}", Valor: ${mov.valor}, GRUPO PRUEBA: "${mov.grupoPrueba}", CLASE PRUEBA: "${mov.clasePrueba}"`);
    });
    
    // Verificar si hay registros duplicados por ID
    const idsUnicos = new Set(costosOperacionales.map(mov => mov.id));
    if (idsUnicos.size !== costosOperacionales.length) {
      console.log(`⚠️ ALERTA: Se encontraron registros duplicados. IDs únicos: ${idsUnicos.size}, Total registros: ${costosOperacionales.length}`);
      
      // Mostrar duplicados
      const conteoIds = costosOperacionales.reduce((acc, mov) => {
        acc[mov.id] = (acc[mov.id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const duplicados = Object.entries(conteoIds).filter(([, count]) => count > 1);
      console.log('IDs duplicados:', duplicados);
    }
    
    // Verificar filtros aplicados
    console.log(`Filtros aplicados - Año: ${año}, Mes: ${mes}`);
    if (filterFormula) {
      console.log(`Fórmula de filtro Airtable: ${filterFormula}`);
    }
    
    if (ingresosOperacionales.length > 0) {
      console.log('Ejemplos de Ingresos Operacionales:', ingresosOperacionales.slice(0, 3).map(mov => ({
        id: mov.id,
        descripcion: mov.descripcion,
        valor: mov.valor,
        grupo: mov.grupo,
        clase: mov.clase
      })));
    }
    
    if (costosOperacionales.length > 0) {
      console.log('Ejemplos de Costos Operacionales:', costosOperacionales.slice(0, 3).map(mov => ({
        id: mov.id,
        descripcion: mov.descripcion,
        valor: mov.valor,
        grupoPrueba: mov.grupoPrueba,
        clasePrueba: mov.clasePrueba
      })));
    }
    
    if (gastosAdministracion.length > 0) {
      console.log('Ejemplos de Gastos Administración:', gastosAdministracion.slice(0, 3).map(mov => ({
        id: mov.id,
        descripcion: mov.descripcion,
        valor: mov.valor,
        grupoPrueba: mov.grupoPrueba,
        clasePrueba: mov.clasePrueba
      })));
    }

    return NextResponse.json({
      success: true,
      data: movimientos,
      total: movimientos.length,
      debug: {
        filtros: { año, mes },
        distribucionGrupoClase: grupoClaseCount,
        costosOperacionales: {
          total: costosOperacionales.length,
          ejemplos: costosOperacionales.slice(0, 5).map(mov => ({
            id: mov.id,
            fecha: mov.fecha,
            descripcion: mov.descripcion,
            valor: mov.valor,
            grupoPrueba: mov.grupoPrueba,
            clasePrueba: mov.clasePrueba
          }))
        },
        gastosAdministracion: {
          total: gastosAdministracionUnicos.length,
          objetivo: 702,
          diferencia: gastosAdministracionUnicos.length - 702,
          ejemplos: gastosAdministracionUnicos.slice(0, 5).map(mov => ({
            id: mov.id,
            fecha: mov.fecha,
            descripcion: mov.descripcion,
            valor: mov.valor,
            grupoPrueba: mov.grupoPrueba,
            clasePrueba: mov.clasePrueba
          }))
        },
        estadisticas: {
          totalRegistros: movimientos.length,
          registrosConGrupoCosto: todosCostos.length,
          registrosConClaseOperacional: todosOperacionales.length,
          registrosCostosOperacionales: costosOperacionales.length,
          idsUnicos: idsUnicos.size,
          hayDuplicados: idsUnicos.size !== costosOperacionales.length
        }
      }
    });

  } catch (error) {
    console.error('Error en API movimientos-bancarios-bancolombia:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}