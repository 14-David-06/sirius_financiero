/**
 * Script para extraer y documentar workflows de n8n
 *
 * Uso: node --env-file=.env.local scripts/extract-n8n-workflows.js
 *
 * Requiere N8N_API_KEY y N8N_BASE_URL en .env.local
 */

const fs = require('fs');
const path = require('path');

const { N8N_API_KEY, N8N_BASE_URL } = process.env;
if (!N8N_API_KEY || !N8N_BASE_URL) {
  console.error('Faltan N8N_API_KEY o N8N_BASE_URL. Ejecuta con: node --env-file=.env.local scripts/extract-n8n-workflows.js');
  process.exit(1);
}
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'n8n-workflows-backup');

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Hacer request a la API de n8n
 */
async function n8nRequest(endpoint, method = 'GET') {
  const url = `${N8N_BASE_URL}/api/v1${endpoint}`;

  console.log(`📡 ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Error en request: ${error.message}`);
    throw error;
  }
}

/**
 * Listar todos los workflows
 */
async function listWorkflows() {
  console.log('\n📋 Listando workflows...\n');

  try {
    const data = await n8nRequest('/workflows');

    if (!data || !data.data) {
      throw new Error('Respuesta inválida de la API');
    }

    const workflows = data.data;
    console.log(`✅ Encontrados ${workflows.length} workflows\n`);

    workflows.forEach((wf, index) => {
      console.log(`${index + 1}. ${wf.name} (ID: ${wf.id})`);
      console.log(`   - Activo: ${wf.active ? '✅' : '❌'}`);
      console.log(`   - Creado: ${wf.createdAt}`);
      console.log(`   - Actualizado: ${wf.updatedAt}`);
      console.log('');
    });

    return workflows;
  } catch (error) {
    console.error('❌ Error listando workflows:', error.message);
    return [];
  }
}

/**
 * Obtener detalles completos de un workflow
 */
async function getWorkflowDetails(workflowId) {
  console.log(`\n🔍 Obteniendo detalles del workflow ${workflowId}...`);

  try {
    const workflow = await n8nRequest(`/workflows/${workflowId}`);
    console.log(`✅ Workflow "${workflow.name}" obtenido correctamente`);
    return workflow;
  } catch (error) {
    console.error(`❌ Error obteniendo workflow ${workflowId}:`, error.message);
    return null;
  }
}

/**
 * Guardar workflow como JSON
 */
function saveWorkflow(workflow) {
  if (!workflow) return;

  const filename = `${workflow.id}_${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(workflow, null, 2), 'utf8');
  console.log(`💾 Guardado en: ${filepath}`);
}

/**
 * Generar documentación markdown de un workflow
 */
function generateWorkflowDocs(workflow) {
  if (!workflow) return;

  const nodes = workflow.nodes || [];
  const connections = workflow.connections || {};

  let markdown = `# Workflow: ${workflow.name}\n\n`;
  markdown += `**ID:** ${workflow.id}\n`;
  markdown += `**Activo:** ${workflow.active ? '✅ Sí' : '❌ No'}\n`;
  markdown += `**Creado:** ${workflow.createdAt}\n`;
  markdown += `**Actualizado:** ${workflow.updatedAt}\n\n`;

  if (workflow.settings?.saveExecutionProgress) {
    markdown += `**Configuración:**\n`;
    markdown += `- Guardar progreso de ejecución: ${workflow.settings.saveExecutionProgress}\n\n`;
  }

  markdown += `## 📊 Diagrama de Flujo\n\n`;
  markdown += '```\n';

  // Intentar reconstruir flujo simple
  const triggerNode = nodes.find(n => n.type.includes('trigger') || n.type.includes('webhook'));
  if (triggerNode) {
    markdown += `[${triggerNode.name}]\n`;
    markdown += '    ↓\n';

    // Seguir conexiones
    const followConnections = (nodeName, depth = 1) => {
      const conn = connections[nodeName];
      if (!conn || !conn.main || !conn.main[0]) return;

      conn.main[0].forEach(c => {
        const targetNode = nodes.find(n => n.name === c.node);
        if (targetNode) {
          markdown += `${'    '.repeat(depth)}[${targetNode.name}]\n`;
          markdown += `${'    '.repeat(depth)}↓\n`;
          followConnections(targetNode.name, depth + 1);
        }
      });
    };

    followConnections(triggerNode.name);
  }

  markdown += '```\n\n';

  markdown += `## 🔧 Nodos (${nodes.length})\n\n`;

  nodes.forEach((node, index) => {
    markdown += `### ${index + 1}. ${node.name}\n`;
    markdown += `- **Tipo:** \`${node.type}\`\n`;
    markdown += `- **Posición:** [${node.position[0]}, ${node.position[1]}]\n`;

    if (node.webhookId) {
      markdown += `- **Webhook ID:** \`${node.webhookId}\`\n`;
    }

    if (node.parameters && Object.keys(node.parameters).length > 0) {
      markdown += `- **Parámetros:**\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(node.parameters, null, 2);
      markdown += '\n```\n';
    }

    if (node.credentials) {
      markdown += `- **Credenciales:** ${Object.keys(node.credentials).join(', ')}\n`;
    }

    markdown += '\n';
  });

  // Guardar markdown
  const filename = `${workflow.id}_${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, markdown, 'utf8');
  console.log(`📝 Documentación guardada en: ${filepath}`);
}

/**
 * Identificar webhooks usados
 */
function identifyWebhooks(workflows) {
  console.log('\n🔗 Identificando webhooks...\n');

  const webhooks = [];

  workflows.forEach(wf => {
    const nodes = wf.nodes || [];
    const webhookNodes = nodes.filter(n =>
      n.type === 'n8n-nodes-base.webhook' ||
      n.webhookId
    );

    webhookNodes.forEach(node => {
      webhooks.push({
        workflowId: wf.id,
        workflowName: wf.name,
        nodeName: node.name,
        webhookId: node.webhookId,
        path: node.parameters?.path || 'unknown',
        method: node.parameters?.httpMethod || 'POST',
      });
    });
  });

  if (webhooks.length > 0) {
    console.log('Webhooks encontrados:\n');
    webhooks.forEach((wh, index) => {
      console.log(`${index + 1}. ${wh.workflowName}`);
      console.log(`   URL: ${N8N_BASE_URL}/webhook/${wh.webhookId || wh.path}`);
      console.log(`   Método: ${wh.method}`);
      console.log('');
    });

    // Guardar resumen de webhooks
    const webhookSummary = {
      generated: new Date().toISOString(),
      baseUrl: N8N_BASE_URL,
      webhooks: webhooks,
    };

    const filepath = path.join(OUTPUT_DIR, 'webhooks-summary.json');
    fs.writeFileSync(filepath, JSON.stringify(webhookSummary, null, 2), 'utf8');
    console.log(`💾 Resumen de webhooks guardado en: ${filepath}\n`);
  } else {
    console.log('⚠️ No se encontraron webhooks\n');
  }

  return webhooks;
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Extractor de Workflows de n8n - Sirius Financiero');
  console.log('='.repeat(60));
  console.log(`📁 Guardando en: ${OUTPUT_DIR}\n`);

  try {
    // 1. Listar workflows
    const workflows = await listWorkflows();

    if (workflows.length === 0) {
      console.log('⚠️ No se encontraron workflows o no se pudo conectar a n8n');
      console.log('\nPosibles causas:');
      console.log('- API Key inválida o expirada');
      console.log('- URL de n8n incorrecta');
      console.log('- Problemas de red/firewall');
      console.log('- n8n no tiene workflows activos');
      return;
    }

    // 2. Obtener detalles de cada workflow
    const detailedWorkflows = [];
    for (const wf of workflows) {
      const details = await getWorkflowDetails(wf.id);
      if (details) {
        detailedWorkflows.push(details);
        saveWorkflow(details);
        generateWorkflowDocs(details);
      }

      // Esperar un poco entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Identificar webhooks
    identifyWebhooks(detailedWorkflows);

    // 4. Crear índice general
    const index = {
      extracted: new Date().toISOString(),
      totalWorkflows: detailedWorkflows.length,
      n8nInstance: N8N_BASE_URL,
      workflows: detailedWorkflows.map(wf => ({
        id: wf.id,
        name: wf.name,
        active: wf.active,
        nodes: wf.nodes?.length || 0,
      })),
    };

    const indexPath = path.join(OUTPUT_DIR, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Extracción completada exitosamente');
    console.log(`📦 ${detailedWorkflows.length} workflows guardados en: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();
