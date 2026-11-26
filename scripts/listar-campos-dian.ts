/**
 * Script para listar todos los campos de la tabla DIAN en Airtable
 * Ejecutar con: npx tsx scripts/listar-campos-dian.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import Airtable from 'airtable';

async function listarCamposDian() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_DIAN_TABLE_ID;

  if (!apiKey || !baseId || !tableId) {
    console.error('❌ Faltan variables de entorno:');
    console.error('  AIRTABLE_API_KEY:', !!apiKey);
    console.error('  AIRTABLE_BASE_ID:', !!baseId);
    console.error('  AIRTABLE_DIAN_TABLE_ID:', !!tableId);
    process.exit(1);
  }

  console.log('🔍 Obteniendo campos de la tabla DIAN...\n');

  const base = new Airtable({ apiKey }).base(baseId);

  try {
    // Obtener un registro para ver todos los campos
    const records = await base(tableId).select({ maxRecords: 1 }).firstPage();

    if (records.length === 0) {
      console.log('⚠️ La tabla está vacía. No se pueden listar campos.');
      return;
    }

    const record = records[0];
    const fields = Object.keys(record.fields);

    console.log('📋 Campos encontrados en la tabla DIAN:');
    console.log('═'.repeat(50));
    fields.sort().forEach((field, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${field}`);
    });
    console.log('═'.repeat(50));
    console.log(`\n✅ Total: ${fields.length} campos\n`);

    // Buscar campos relacionados con "tipo" o "documento"
    console.log('🔎 Campos que contienen "tipo" o "documento":');
    const relacionados = fields.filter(f =>
      f.toLowerCase().includes('tipo') || f.toLowerCase().includes('documento')
    );
    if (relacionados.length > 0) {
      relacionados.forEach(f => console.log(`  → ${f}`));
    } else {
      console.log('  (ninguno)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listarCamposDian();
