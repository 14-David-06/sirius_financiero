'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface DiagnosticResult {
  status: 'success' | 'error';
  data?: Record<string, unknown> | unknown[];
  error?: string;
  timestamp?: string;
}

export default function DiagnosticPanel() {
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runDiagnostic = async (endpoint: string, name: string) => {
    setLoading(prev => ({ ...prev, [name]: true }));
    
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      
      setResults(prev => ({
        ...prev,
        [name]: {
          status: response.ok ? 'success' : 'error',
          data: response.ok ? data : undefined,
          error: response.ok ? undefined : data.error || `HTTP ${response.status}`,
          timestamp: new Date().toLocaleString()
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [name]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toLocaleString()
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const diagnostics = [
    {
      name: 'API Compras',
      endpoint: '/api/compras?maxRecords=1',
      description: 'Verifica si la API de compras funciona correctamente'
    },
    {
      name: 'Variables de Entorno',
      endpoint: '/api/debug/env-check',
      description: 'Verifica el estado de las variables de entorno'
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Panel de Diagnóstico - Sirius Financiero
        </h1>
        <p className="text-gray-600">
          Herramientas para diagnosticar problemas en producción
        </p>
      </div>

      <div className="grid gap-4">
        {diagnostics.map(({ name, endpoint, description }) => (
          <Card key={name} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{name}</h3>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
              <Button
                onClick={() => runDiagnostic(endpoint, name)}
                disabled={loading[name]}
                className="min-w-[100px]"
              >
                {loading[name] ? 'Probando...' : 'Probar'}
              </Button>
            </div>

            {results[name] && (
              <div className={`mt-3 p-3 rounded-lg border ${
                results[name].status === 'success' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${
                    results[name].status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium">
                    {results[name].status === 'success' ? 'Éxito' : 'Error'}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {results[name].timestamp}
                  </span>
                </div>

                {results[name].error && (
                  <div className="text-sm text-red-700 mb-2">
                    <strong>Error:</strong> {results[name].error}
                  </div>
                )}

                {results[name].data && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
                      Ver detalles
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(results[name].data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">
          📋 Pasos para resolver problemas en producción:
        </h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Ejecuta los diagnósticos arriba para identificar el problema específico</li>
          <li>Si fallan las variables de entorno, ve a tu dashboard de Vercel</li>
          <li>Configura las variables de entorno en Settings → Environment Variables</li>
          <li>Asegúrate de que estén configuradas para &quot;Production&quot;</li>
          <li>Redeploy tu aplicación después de configurar las variables</li>
          <li>Ejecuta nuevamente los diagnósticos para verificar</li>
        </ol>
      </Card>

      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <h3 className="font-semibold text-yellow-900 mb-2">
          🔧 Enlaces útiles:
        </h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>
            <a 
              href="https://vercel.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Dashboard de Vercel
            </a>
          </li>
          <li>
            <a 
              href="https://vercel.com/docs/concepts/projects/environment-variables" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Documentación de Variables de Entorno
            </a>
          </li>
        </ul>
      </Card>
    </div>
  );
}
