'use client';

import React, { useState } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  Calculator, 
  AlertCircle,
  Settings,
  Zap,
  Clock,
  Send,
  CheckCircle,
  List
} from 'lucide-react';

interface SimulacionConfig {
  tipo: 'normal' | 'prioridad';
  incluirIngresos: 'con_ingresos' | 'sin_ingresos' | '';
  prioridadesSeleccionadas: ('Alta' | 'Media' | 'Baja')[];
}

export default function SimuladorProyecciones() {
  const { isAuthenticated, isLoading } = useAuthSession();
  const [config, setConfig] = useState<SimulacionConfig>({
    tipo: 'normal',
    incluirIngresos: '',
    prioridadesSeleccionadas: []
  });
  const [enviando, setEnviando] = useState(false);
  const [esperandoRespuesta, setEsperandoRespuesta] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{tipo: 'success' | 'error' | 'info', texto: string} | null>(null);

  const togglePrioridad = (prioridad: 'Alta' | 'Media' | 'Baja') => {
    setConfig(prev => ({
      ...prev,
      prioridadesSeleccionadas: prev.prioridadesSeleccionadas.includes(prioridad)
        ? prev.prioridadesSeleccionadas.filter(p => p !== prioridad)
        : [...prev.prioridadesSeleccionadas, prioridad]
    }));
  };

  const esperarRespuesta = async (requestId: string) => {
    setEsperandoRespuesta(true);
    setMensaje({
      tipo: 'info',
      texto: 'Procesando simulación... esto puede tomar unos minutos.'
    });

    const maxIntentos = 60; // 10 minutos máximo (60 * 10 segundos)
    let intentos = 0;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/simulation-response?id=${requestId}`);
        const data = await response.json();

        if (data.completed) {
          clearInterval(interval);
          setEsperandoRespuesta(false);
          setCurrentRequestId(null);

          if (data.error) {
            setMensaje({
              tipo: 'error',
              texto: `Error en simulación: ${data.error}`
            });
          } else {
            setMensaje({
              tipo: 'success',
              texto: `Simulación completada: ${data.result || 'Procesamiento exitoso'}`
            });
          }

          // Resetear configuración después del resultado
          setConfig({
            tipo: 'normal',
            incluirIngresos: '',
            prioridadesSeleccionadas: []
          });
        }

        intentos++;
        if (intentos >= maxIntentos) {
          clearInterval(interval);
          setEsperandoRespuesta(false);
          setCurrentRequestId(null);
          setMensaje({
            tipo: 'error',
            texto: 'Tiempo de espera agotado. La simulación puede estar aún procesándose.'
          });
        }
      } catch (error) {
        console.error('Error verificando estado de simulación:', error);
        intentos++;
      }
    }, 10000); // Consulta cada 10 segundos

    return interval;
  };

  const enviarSimulacion = async () => {
    setEnviando(true);
    setMensaje(null);

    try {
      // Generar ID único para esta simulación
      const requestId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const payload = {
        tipo_simulacion: config.tipo,
        incluir_ingresos: config.tipo === 'prioridad' ? config.incluirIngresos : 'con_ingresos',
        prioridades_seleccionadas: config.tipo === 'prioridad' ? config.prioridadesSeleccionadas : [],
        request_id: requestId,
        callback_url: `${window.location.origin}/api/simulation-response`,
        timestamp: new Date().toISOString(),
        usuario: 'Sistema Sirius Financiero'
      };

      console.log('Enviando payload:', payload);

      const webhookUrl = process.env.NEXT_PUBLIC_N8N_SIMULATION_WEBHOOK;
      
      if (!webhookUrl) {
        throw new Error('URL del webhook no configurada');
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        setEnviando(false);
        setCurrentRequestId(requestId);
        
        setMensaje({
          tipo: 'success',
          texto: 'Simulación enviada exitosamente. Esperando resultados...'
        });

        // Comenzar a esperar la respuesta
        esperarRespuesta(requestId);
        
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error enviando simulación:', error);
      
      // Mensaje de error más específico
      let errorMessage = 'Error al enviar la simulación. ';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage += 'Problema de conectividad. Verifique su conexión a internet.';
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Error desconocido. Intente nuevamente.';
      }
      
      setMensaje({
        tipo: 'error',
        texto: errorMessage
      });
      setEnviando(false);
    }
  };

  const puedeSimular = () => {
    if (esperandoRespuesta) return false; // No permitir nueva simulación mientras se espera respuesta
    if (config.tipo === 'normal') return true;
    if (config.tipo === 'prioridad') {
      return config.incluirIngresos !== '' && config.prioridadesSeleccionadas.length > 0;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-24"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-24"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center">
          <div className="bg-red-500/20 backdrop-blur-md rounded-3xl p-8 border border-red-500/30 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Acceso Denegado</h2>
            <p className="text-white/80">Debe iniciar sesión para usar el simulador</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <Calculator className="w-8 h-8 text-white mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                Simulador de Proyecciones
              </h1>
            </div>
            <p className="text-white/80">
              Configure el tipo de simulación financiera a realizar
            </p>
          </div>

          {/* Formulario de Configuración */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
            
            {/* Mensaje de estado */}
            {mensaje && (
              <div className={`mb-6 p-4 rounded-lg border ${
                mensaje.tipo === 'success' 
                  ? 'bg-green-500/20 border-green-500/30 text-green-300'
                  : mensaje.tipo === 'info'
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                  : 'bg-red-500/20 border-red-500/30 text-red-300'
              }`}>
                <div className="flex items-center">
                  {mensaje.tipo === 'success' ? (
                    <CheckCircle className="w-5 h-5 mr-2" />
                  ) : mensaje.tipo === 'info' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-300 mr-2"></div>
                  ) : (
                    <AlertCircle className="w-5 h-5 mr-2" />
                  )}
                  {mensaje.texto}
                </div>
              </div>
            )}

            {/* Selección de Tipo de Simulación */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Tipo de Simulación
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setConfig(prev => ({ ...prev, tipo: 'normal' }))}
                  className={`p-6 rounded-lg border transition-all duration-200 ${
                    config.tipo === 'normal'
                      ? 'bg-white/20 border-white/40 text-white ring-2 ring-blue-400'
                      : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center justify-center mb-3">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Simulación Normal</h3>
                  <p className="text-sm text-white/70">
                    Análisis financiero estándar con parámetros predefinidos
                  </p>
                </button>

                <button
                  onClick={() => setConfig(prev => ({ ...prev, tipo: 'prioridad' }))}
                  className={`p-6 rounded-lg border transition-all duration-200 ${
                    config.tipo === 'prioridad'
                      ? 'bg-white/20 border-white/40 text-white ring-2 ring-purple-400'
                      : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center justify-center mb-3">
                    <Zap className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Con Prioridades</h3>
                  <p className="text-sm text-white/70">
                    Análisis personalizado basado en prioridades específicas
                  </p>
                </button>
              </div>
            </div>

            {/* Configuración de Prioridades */}
            {config.tipo === 'prioridad' && (
              <div className="mb-8 p-6 bg-white/10 rounded-lg border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <List className="w-5 h-5 mr-2" />
                  ¡Genial! Has seleccionado la Opción 2 Simular proyecciones según las prioridades
                </h3>
                
                <p className="text-white/90 mb-6">
                  Ahora, por favor indica cómo deseas realizar la simulación:
                </p>

                {/* Selección de ingresos */}
                <div className="mb-6">
                  <label className="block text-white/90 text-sm font-medium mb-3">
                    ¿Quieres incluir los ingresos en la proyección?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, incluirIngresos: 'con_ingresos' }))}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        config.incluirIngresos === 'con_ingresos'
                          ? 'bg-green-600/30 border-green-500/50 text-white ring-2 ring-green-400'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Con ingresos
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, incluirIngresos: 'sin_ingresos' }))}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        config.incluirIngresos === 'sin_ingresos'
                          ? 'bg-red-600/30 border-red-500/50 text-white ring-2 ring-red-400'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Sin ingresos
                    </button>
                  </div>
                </div>

                {/* Selección de prioridades */}
                <div className="mb-4">
                  <label className="block text-white/90 text-sm font-medium mb-3">
                    ¿Qué tipo de prioridades quieres tener en cuenta?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => togglePrioridad('Alta')}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        config.prioridadesSeleccionadas.includes('Alta')
                          ? 'bg-red-600/30 border-red-500/50 text-white ring-2 ring-red-400'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Alta
                    </button>
                    <button
                      onClick={() => togglePrioridad('Media')}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        config.prioridadesSeleccionadas.includes('Media')
                          ? 'bg-yellow-600/30 border-yellow-500/50 text-white ring-2 ring-yellow-400'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Media
                    </button>
                    <button
                      onClick={() => togglePrioridad('Baja')}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        config.prioridadesSeleccionadas.includes('Baja')
                          ? 'bg-green-600/30 border-green-500/50 text-white ring-2 ring-green-400'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      Baja
                    </button>
                  </div>
                </div>

                {/* Resumen de selección */}
                {(config.incluirIngresos !== '' || config.prioridadesSeleccionadas.length > 0) && (
                  <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <h4 className="text-white font-medium mb-2">Configuración seleccionada:</h4>
                    <div className="space-y-1">
                      {config.incluirIngresos !== '' && (
                        <p className="text-white/80 text-sm">
                          • Ingresos: {config.incluirIngresos === 'con_ingresos' ? 'Incluidos' : 'No incluidos'}
                        </p>
                      )}
                      {config.prioridadesSeleccionadas.length > 0 && (
                        <p className="text-white/80 text-sm">
                          • Prioridades: ({config.prioridadesSeleccionadas.join(', ')})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-white/70 text-sm">
                    Esta configuración nos ayudará a organizar tus egresos según su importancia y ajustar la simulación de acuerdo a tus necesidades. ¡Adelante!
                  </p>
                </div>
              </div>
            )}

            {/* Botón de Simular */}
            <div className="text-center">
              <button
                onClick={enviarSimulacion}
                disabled={!puedeSimular() || enviando || esperandoRespuesta}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-300 shadow-lg"
              >
                {enviando ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Enviando...
                  </>
                ) : esperandoRespuesta ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Procesando simulación...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-3" />
                    Iniciar Simulación
                  </>
                )}
              </button>
              
              {!puedeSimular() && config.tipo === 'prioridad' && !esperandoRespuesta && (
                <p className="mt-2 text-white/60 text-sm">
                  {config.incluirIngresos === '' && config.prioridadesSeleccionadas.length === 0 && 
                    'Debe seleccionar cómo manejar los ingresos y al menos una prioridad'
                  }
                  {config.incluirIngresos === '' && config.prioridadesSeleccionadas.length > 0 && 
                    'Debe seleccionar cómo manejar los ingresos'
                  }
                  {config.incluirIngresos !== '' && config.prioridadesSeleccionadas.length === 0 && 
                    'Debe seleccionar al menos una prioridad'
                  }
                </p>
              )}

              {esperandoRespuesta && (
                <p className="mt-2 text-blue-300 text-sm">
                  ⏱️ Simulación en proceso. Request ID: {currentRequestId}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
