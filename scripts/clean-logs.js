#!/usr/bin/env node

/**
 * 🧹 SCRIPT DE LIMPIEZA DE LOGS DE PRODUCCIÓN
 * Limpia logs sensibles antes del deploy a producción
 */

const fs = require('fs');
const path = require('path');

// Patrones de logs sensibles que deben ser removidos
const SENSITIVE_LOG_PATTERNS = [
  /console\.log\([^)]*cedula[^)]*\)/gi,
  /console\.log\([^)]*password[^)]*\)/gi,
  /console\.log\([^)]*token[^)]*\)/gi,
  /console\.log\([^)]*api_key[^)]*\)/gi,
  /console\.log\([^)]*telefono[^)]*\)/gi,
  /console\.log\([^)]*email[^)]*\)/gi,
  /console\.log\([^)]*'Datos recibidos:'[^)]*\)/gi,
  /console\.log\([^)]*"Datos recibidos:"[^)]*\)/gi
];

// Extensiones de archivos a procesar
const VALID_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Encuentra archivos recursivamente sin usar glob
 */
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Evitar directorios que no necesitamos procesar
      if (!['node_modules', '.next', 'dist', '.git'].includes(file)) {
        findFiles(filePath, fileList);
      }
    } else {
      // Solo procesar archivos con extensiones válidas
      const ext = path.extname(file);
      if (VALID_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Limpia logs sensibles de un archivo
 */
function cleanSensitiveLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    SENSITIVE_LOG_PATTERNS.forEach(pattern => {
      const originalContent = content;
      content = content.replace(pattern, '// Log removido por seguridad');
      if (content !== originalContent) {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Limpiado: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Procesa todos los archivos
 */
function processFiles() {
  console.log('🧹 Iniciando limpieza de logs sensibles...\n');
  
  const srcDir = path.join(process.cwd(), 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.log('❌ Directorio src/ no encontrado');
    return;
  }
  
  const files = findFiles(srcDir);
  let processedFiles = 0;
  let cleanedFiles = 0;
  
  files.forEach(file => {
    processedFiles++;
    if (cleanSensitiveLogs(file)) {
      cleanedFiles++;
    }
  });
  
  console.log(`\n📊 Resumen:`);
  console.log(`   Total archivos encontrados: ${files.length}`);
  console.log(`   Archivos procesados: ${processedFiles}`);
  console.log(`   Archivos limpiados: ${cleanedFiles}`);
  console.log(`\n✅ Limpieza completada!`);
}

/**
 * Verifica que no queden logs sensibles
 */
function verifyCleanup() {
  console.log('\n🔍 Verificando limpieza...');
  
  const srcDir = path.join(process.cwd(), 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.log('❌ Directorio src/ no encontrado');
    return;
  }
  
  const files = findFiles(srcDir);
  let foundIssues = false;
  let checkedFiles = 0;
  
  files.forEach(file => {
    checkedFiles++;
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      SENSITIVE_LOG_PATTERNS.forEach((pattern, index) => {
        if (pattern.test(content)) {
          console.warn(`⚠️  Log sensible encontrado en ${path.relative(process.cwd(), file)}`);
          foundIssues = true;
        }
      });
    } catch (error) {
      console.error(`❌ Error verificando ${file}:`, error.message);
    }
  });
  
  console.log(`\n📊 Verificación completada:`);
  console.log(`   Archivos verificados: ${checkedFiles}`);
  
  if (!foundIssues) {
    console.log('✅ No se encontraron logs sensibles restantes');
    return true;
  } else {
    console.log('❌ Se encontraron logs sensibles que requieren atención manual');
    return false;
  }
}

/**
 * Verificar si hay archivos .env expuestos
 */
function checkEnvFiles() {
  console.log('\n🔍 Verificando archivos .env...');
  
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
  let hasExposedFiles = false;
  
  envFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.warn(`⚠️  Archivo .env encontrado: ${file}`);
      
      // Verificar si está en .gitignore
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        if (!gitignoreContent.includes('.env') && !gitignoreContent.includes(file)) {
          console.error(`🚨 ${file} NO está en .gitignore!`);
          hasExposedFiles = true;
        } else {
          console.log(`✅ ${file} está protegido en .gitignore`);
        }
      } else {
        console.error(`🚨 No se encontró .gitignore!`);
        hasExposedFiles = true;
      }
    }
  });
  
  if (!hasExposedFiles) {
    console.log('✅ Todos los archivos .env están protegidos');
  }
  
  return !hasExposedFiles;
}

// Ejecutar script
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clean':
      processFiles();
      break;
    case 'verify':
      const cleanupOk = verifyCleanup();
      const envOk = checkEnvFiles();
      if (!cleanupOk || !envOk) {
        process.exit(1);
      }
      break;
    case 'all':
      processFiles();
      const allCleanupOk = verifyCleanup();
      const allEnvOk = checkEnvFiles();
      if (!allCleanupOk || !allEnvOk) {
        process.exit(1);
      }
      break;
    default:
      console.log(`
🔒 Script de Limpieza de Logs - Sirius Financiero

Uso:
  node scripts/clean-logs.js clean   - Limpiar logs sensibles
  node scripts/clean-logs.js verify  - Verificar limpieza
  node scripts/clean-logs.js all     - Limpiar y verificar

Ejemplos:
  npm run security:clean
  npm run security:check
  npm run security:audit
      `);
  }
}

module.exports = {
  cleanSensitiveLogs,
  processFiles,
  verifyCleanup,
  checkEnvFiles
};

// Ejecutar script
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clean':
      processFiles();
      break;
    case 'verify':
      verifyCleanup();
      break;
    case 'all':
      processFiles();
      verifyCleanup();
      break;
    default:
      console.log(`
🔒 Script de Limpieza de Logs - Sirius Financiero

Uso:
  node scripts/clean-logs.js clean   - Limpiar logs sensibles
  node scripts/clean-logs.js verify  - Verificar limpieza
  node scripts/clean-logs.js all     - Limpiar y verificar

Ejemplos:
  npm run clean:logs
  npm run verify:logs
      `);
  }
}

module.exports = {
  cleanSensitiveLogs,
  processFiles,
  verifyCleanup
};
