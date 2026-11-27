'use client';

import React, { useEffect, useState } from 'react';
import { Calculator, CircleAlert, LoaderCircle } from 'lucide-react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import ConfiguracionSimulacion, { type SimulacionConfig } from '@/components/ConfiguracionSimulacion';
import InformeSimulador, { type MetadataSimulacion } from '@/components/InformeSimulador';
import type { InformeSimulacion } from '@/lib/simulador/proyeccion';

const FONDO = 'https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg';

function Fondo({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{ backgroundImage: `url(${FONDO})` }}
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <Fondo>
      <div className="min-h-screen flex items-center justify-center px-4 pt-32 pb-16">{children}</div>
    </Fondo>
  );
}

export default function SimuladorProyecciones() {
  const { isAuthenticated, isLoading } = useAuthSession();
  const [config, setConfig] = useState<SimulacionConfig>({
    tipo: 'normal',
    incluirIngresos: '',
    prioridadesSeleccionadas: [],
  });
  const [enviando, setEnviando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ informe: InformeSimulacion; metadata: MetadataSimulacion } | null>(
    null
  );

  useEffect(() => {
    if (!enviando) return;
    const inicio = Date.now();
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(id);
  }, [enviando]);

  const enviarSimulacion = async () => {
    setError(null);
    setSegundos(0);
    setEnviando(true);

    try {
      const response = await fetch('/api/simulador-proyecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_simulacion: config.tipo,
          incluir_ingresos: config.tipo === 'prioridad' ? config.incluirIngresos : 'con_ingresos',
          prioridades_seleccionadas: config.tipo === 'prioridad' ? config.prioridadesSeleccionadas : [],
        }),
      });
      const data = await response.json().catch(() => null);

      if (!data) {
        setError(
          `El servidor respondió ${response.status} sin datos. Si tardó más de un minuto, pudo agotarse el tiempo de ejecución.`
        );
      } else if (response.ok && data.success) {
        setResultado({ informe: data.informe, metadata: data.metadata });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.detalles ? `${data.error ?? 'Error'}: ${data.detalles}` : data.error || 'Error desconocido.');
      }
    } catch (e) {
      console.error('Error en simulación:', e);
      setError(
        e instanceof TypeError
          ? 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.'
          : e instanceof Error
            ? e.message
            : 'Error desconocido. Intenta nuevamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <Aviso>
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl text-center">
          <LoaderCircle className="w-10 h-10 text-white animate-spin mx-auto mb-3" />
          <p className="text-white">Cargando…</p>
        </div>
      </Aviso>
    );
  }

  if (!isAuthenticated) {
    return (
      <Aviso>
        <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-8 border border-red-400/30 shadow-xl text-center">
          <CircleAlert className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acceso denegado</h2>
          <p className="text-white/80">Debes iniciar sesión para usar el simulador.</p>
        </div>
      </Aviso>
    );
  }

  return (
    <Fondo>
      <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className={`${resultado ? 'max-w-5xl' : 'max-w-4xl'} mx-auto space-y-6`}>
          <header className="flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-2xl p-5 md:p-6 border border-white/20 shadow-xl">
            <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/70 to-purple-500/70 border border-white/20 shrink-0">
              <Calculator className="w-6 h-6 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white">Simulador de Proyecciones</h1>
              <p className="text-white/70 text-sm md:text-base">
                Proyecta el saldo de caja semana a semana y descubre hasta cuándo alcanza.
              </p>
            </div>
          </header>

          {resultado ? (
            <InformeSimulador
              informe={resultado.informe}
              metadata={resultado.metadata}
              onNuevaSimulacion={() => setResultado(null)}
            />
          ) : (
            <ConfiguracionSimulacion
              config={config}
              onChange={setConfig}
              enviando={enviando}
              segundos={segundos}
              error={error}
              onSimular={enviarSimulacion}
            />
          )}
        </div>
      </div>
    </Fondo>
  );
}
