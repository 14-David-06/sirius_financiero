'use client';

import { useState } from 'react';
import { Eye, EyeOff, User, Lock, LogIn } from 'lucide-react';
import { UserData } from '@/types/compras';

interface LoginComponentProps {
  onLoginSuccess: (userData: UserData) => void;
  onBack?: () => void;
}

export default function LoginComponent({ onLoginSuccess, onBack }: LoginComponentProps) {
  const [step, setStep] = useState<'cedula' | 'password' | 'setup'>('cedula');
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);

  const handleCedulaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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

      if (data.valid) {
        setUserData(data.user);
        if (data.needsPasswordSetup) {
          setStep('setup');
        } else {
          setStep('password');
        }
      } else if (data.inactive) {
        setError(data.message);
      } else {
        setError('Cédula no encontrada en el sistema. Contacte al administrador.');
      }
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cedula, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Después de configurar, proceder con el login
        handleLogin();
      } else {
        setError(data.error || 'Error al configurar la contraseña');
      }
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cedula, password }),
      });

      const data = await response.json();

      if (data.success) {
        onLoginSuccess(data.user);
      } else if (data.needsPasswordSetup) {
        setStep('setup');
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('cedula');
    setCedula('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setUserData(null);
  };

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="bg-blue-500/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Sirius Financiero</h2>
        <p className="text-white/80 text-sm">
          {step === 'cedula' && 'Ingrese su número de cédula'}
          {step === 'password' && `Bienvenido, ${userData?.nombre}`}
          {step === 'setup' && 'Configure su contraseña'}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6 text-white text-sm">
          {error}
        </div>
      )}

      {/* Paso 1: Ingresar Cédula */}
      {step === 'cedula' && (
        <form onSubmit={handleCedulaSubmit} className="space-y-6">
          <div className="relative">
            <label htmlFor="cedula" className="block text-white/90 text-sm font-medium mb-2">
              Número de Cédula
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type="text"
                id="cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                placeholder="Ejemplo: 1234567890"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                required
                maxLength={15}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !cedula}
            className="w-full bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Validando...' : 'Continuar'}
          </button>
        </form>
      )}

      {/* Paso 2: Ingresar Contraseña */}
      {step === 'password' && (
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="bg-blue-500/10 rounded-lg p-4 mb-4">
            <p className="text-white/90 text-sm">
              <strong>Usuario:</strong> {userData?.nombre}<br />
              <strong>Categoría:</strong> {userData?.categoria}
            </p>
          </div>

          <div className="relative">
            <label htmlFor="password" className="block text-white/90 text-sm font-medium mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      )}

      {/* Paso 3: Configurar Contraseña */}
      {step === 'setup' && (
        <form onSubmit={handlePasswordSetup} className="space-y-6">
          <div className="bg-green-500/10 rounded-lg p-4 mb-4">
            <p className="text-white/90 text-sm">
              <strong>Bienvenido, {userData?.nombre}!</strong><br />
              Configure su contraseña para acceder al sistema por primera vez.
            </p>
          </div>

          <div className="relative">
            <label htmlFor="newPassword" className="block text-white/90 text-sm font-medium mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="confirmPassword" className="block text-white/90 text-sm font-medium mb-2">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme su contraseña"
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="text-white/70 text-xs space-y-1">
            <p>• La contraseña debe tener al menos 6 caracteres</p>
            <p>• Recomendamos usar una combinación de letras, números y símbolos</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword || password !== confirmPassword}
              className="flex-1 bg-gradient-to-r from-green-600/80 to-blue-600/80 hover:from-green-700/90 hover:to-blue-700/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Configurando...' : 'Configurar'}
            </button>
          </div>
        </form>
      )}

      {/* Botón de Volver */}
      {onBack && (
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-all duration-300 border border-white/20"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Inicio
          </button>
        </div>
      )}
    </div>
  );
}
