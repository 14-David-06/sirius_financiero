import { NextRequest, NextResponse } from 'next/server';
import {
  simularNormal,
  simularPrioridadConIngresos,
  simularPrioridadSinIngresos,
} from '@/lib/simulador/proyeccion';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

interface PayloadSimulacion {
  tipo_simulacion: 'normal' | 'prioridad';
  incluir_ingresos?: 'con_ingresos' | 'sin_ingresos';
  prioridades_seleccionadas?: string[];
  request_id?: string;
  usuario?: string;
}

/**
 * Simulador de Proyecciones
 *
 * POST /api/simulador-proyecciones
 * Reemplaza el workflow n8n "AUTOMA_Simulador_Proyecciones" (e2NRJ7zC5VQFUcPc).
 *
 * Respuesta SÍNCRONA (60s max) - elimina polling y Map en memoria.
 * Requiere autenticación.
 *
 * Payload:
 * {
 *   "tipo_simulacion": "normal" | "prioridad",
 *   "incluir_ingresos": "con_ingresos" | "sin_ingresos",  // solo si tipo=prioridad
 *   "prioridades_seleccionadas": ["Alta","Media","Baja"],  // solo si tipo=prioridad
 *   "request_id": "sim_...",  // opcional
 *   "usuario": "nombre"  // opcional
 * }
 *
 * IMPORTANTE: Replica comportamiento n8n incluyendo bugs conocidos:
 * - Rama C (prioridad sin ingresos) siempre filtra solo "Alta" ignorando selección
 * - Rama B (prioridad con ingresos) puede tener fórmula rota con arrays
 * - Todas las simulaciones ESCRIBEN en Centralización General (destructivo)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let decoded: { nombre: string; categoria: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { nombre: string; categoria: string };
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Parsear payload
    const payload: PayloadSimulacion = await request.json();

    const {
      tipo_simulacion,
      incluir_ingresos = 'con_ingresos',
      prioridades_seleccionadas = [],
      request_id = `sim_${Date.now()}`,
      usuario = decoded.nombre,
    } = payload;

    // 3. Validar payload
    if (!['normal', 'prioridad'].includes(tipo_simulacion)) {
      return NextResponse.json(
        { error: 'tipo_simulacion debe ser "normal" o "prioridad"' },
        { status: 400 }
      );
    }

    if (tipo_simulacion === 'prioridad') {
      if (!['con_ingresos', 'sin_ingresos'].includes(incluir_ingresos)) {
        return NextResponse.json(
          { error: 'incluir_ingresos debe ser "con_ingresos" o "sin_ingresos"' },
          { status: 400 }
        );
      }

      if (!Array.isArray(prioridades_seleccionadas) || prioridades_seleccionadas.length === 0) {
        return NextResponse.json(
          { error: 'prioridades_seleccionadas debe ser un array no vacío para tipo=prioridad' },
          { status: 400 }
        );
      }
    }

    const inicio = Date.now();
    console.log(`🔄 [Simulador] Iniciando: ${tipo_simulacion}${tipo_simulacion === 'prioridad' ? ` (${incluir_ingresos})` : ''} - usuario: ${usuario}`);

    // 4. Ejecutar simulación según rama
    let resultado: string;

    if (tipo_simulacion === 'normal') {
      // Rama A
      resultado = await simularNormal();
    } else {
      // Ramas B y C
      if (incluir_ingresos === 'con_ingresos') {
        // Rama B
        resultado = await simularPrioridadConIngresos(prioridades_seleccionadas);
      } else {
        // Rama C (bug: ignora prioridades, siempre usa "Alta")
        resultado = await simularPrioridadSinIngresos(prioridades_seleccionadas);
      }
    }

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log(`✅ [Simulador] Completado en ${duracion}s`, {
      tipo: tipo_simulacion,
      incluirIngresos: incluir_ingresos,
      prioridades: prioridades_seleccionadas,
      request_id,
    });

    // 5. Respuesta síncrona directa (no polling)
    return NextResponse.json({
      success: true,
      result: resultado,
      status: 'completed',
      request_id,
      metadata: {
        tipo_simulacion,
        incluir_ingresos: tipo_simulacion === 'prioridad' ? incluir_ingresos : undefined,
        prioridades: tipo_simulacion === 'prioridad' ? prioridades_seleccionadas : undefined,
        duracionSegundos: parseFloat(duracion),
        usuario,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [Simulador] Error:', error);

    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: 'Error al ejecutar la simulación',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

// Incrementar maxDuration para dar tiempo a la propagación secuencial
export const maxDuration = 60; // 60 segundos
