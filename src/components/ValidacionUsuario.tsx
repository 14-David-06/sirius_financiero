'use client';

import { useState } from 'react';

interface ValidacionUsuarioProps {
  onValidationSuccess: (userData: any) => void;
  onValidationError: (error: string) => void;
}

interface UserData {
  cedula: string;
  nombre: string;
  cargo: string;
  area: string;
  email: string;
}

// Iconos SVG simples
const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

export default function ValidacionUsuario({ onValidationSuccess, onValidationError }: ValidacionUsuarioProps) {
  const [cedula, setCedula] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showCedula, setShowCedula] = useState(false);
  const [error, setError] = useState('');

  const validateCedula = (cedulaInput: string): boolean => {
    // Validar que solo contenga números
    const numbersOnly = /^\d+$/.test(cedulaInput);
    // Validar longitud (entre 6 y 12 dígitos)
    const validLength = cedulaInput.length >= 6 && cedulaInput.length <= 12;
    
    return numbersOnly && validLength;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cedula.trim()) {
      setError('Por favor ingrese su cédula');
      return;
    }

    if (!validateCedula(cedula)) {
      setError('La cédula debe contener solo números y tener entre 6 y 12 dígitos');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const response = await fetch('/api/validate-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cedula }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.valid) {
          onValidationSuccess(data.user);
        } else {
          setError(data.message || 'Cédula no encontrada en el sistema');
          onValidationError(data.message || 'Cédula no encontrada en el sistema');
        }
      } else {
        setError(data.error || 'Error al validar usuario');
        onValidationError(data.error || 'Error al validar usuario');
      }
    } catch (error) {
      const errorMessage = 'Error de conexión. Intente nuevamente';
      setError(errorMessage);
      onValidationError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Solo permitir números
    if (value === '' || /^\d+$/.test(value)) {
      setCedula(value);
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              🔐 Validación de Acceso
            </h2>
            <p className="text-white/90 text-lg drop-shadow-md">
              Ingrese su cédula para acceder al monitoreo de solicitudes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="cedula" className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                Número de Cédula
              </label>
              <div className="relative">
                <input
                  id="cedula"
                  type={showCedula ? 'text' : 'password'}
                  value={cedula}
                  onChange={handleCedulaChange}
                  placeholder="Ingrese su número de cédula"
                  className="w-full p-4 pr-12 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300 text-lg"
                  maxLength={12}
                  autoComplete="off"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCedula(!showCedula)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                >
                  {showCedula ? (
                    <EyeSlashIcon />
                  ) : (
                    <EyeIcon />
                  )}
                </button>
              </div>
              {cedula && !validateCedula(cedula) && (
                <p className="mt-2 text-red-300 text-sm drop-shadow-md">
                  La cédula debe contener solo números y tener entre 6 y 12 dígitos
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4">
                <p className="text-red-300 text-center font-medium drop-shadow-md">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isValidating || !cedula || !validateCedula(cedula)}
              className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
            >
              {isValidating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Validando...
                </div>
              ) : (
                '🔍 Validar Acceso'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/70 text-sm drop-shadow-md">
              Solo el personal autorizado del equipo financiero puede acceder a esta sección
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
