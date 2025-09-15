'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { UserData } from '@/types/compras';
import LoginComponent from './LoginComponent';

export default function LandingPage() {
  const { isAuthenticated, userData, isLoading, login } = useAuthSession();
  const [showLogin, setShowLogin] = useState(false);

  // Verificar si se debe mostrar login automáticamente
  useEffect(() => {
    const shouldShowLogin = localStorage.getItem('showLogin');
    if (shouldShowLogin === 'true') {
      setShowLogin(true);
      localStorage.removeItem('showLogin'); // Limpiar después de usar
    }
  }, []);

  const handleLoginSuccess = (userData: UserData) => {
    // Primero actualizar el estado local
    login(userData);
    setShowLogin(false);
    
    // Pequeño delay para asegurar que el estado se propague
    setTimeout(() => {
      // Forzar re-verificación en todos los hooks
      window.dispatchEvent(new CustomEvent('forceAuthCheck'));
    }, 50);
  };

  // Si está cargando, mostrar loading
  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752165981/20032025-DSCF8381_2_1_jzs49t.jpg'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 text-center">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752165981/20032025-DSCF8381_2_1_jzs49t.jpg'
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto min-h-[calc(100vh-5rem)] flex flex-col justify-center">
          <div className="text-center">
            {/* Header Card - Solo mostrar si NO está mostrando login */}
            {!showLogin && (
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 mb-12 border border-white/20 shadow-2xl">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
                  Sirius Financiero
                </h1>
                <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
                  Plataforma integral para la gestión de solicitudes de compra y monitoreo financiero empresarial
                </p>
                {isAuthenticated && userData && (
                  <div className="bg-green-500/20 backdrop-blur-md rounded-2xl p-4 mt-6 border border-green-500/30">
                    <p className="text-white/90 text-lg">
                      ¡Bienvenido, <strong>{userData.nombre}</strong>!
                    </p>
                    <p className="text-white/70 text-sm">
                      {userData.categoria} • Sesión activa
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {isAuthenticated ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 justify-center max-w-6xl mx-auto px-4">
                <Link
                  href="/solicitudes-compra"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-500/30 to-indigo-600/30 hover:from-blue-500/50 hover:to-indigo-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-blue-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Solicitudes de Compra
                  </span>
                </Link>
                <Link
                  href="/mis-solicitudes"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-emerald-500/30 to-teal-600/30 hover:from-emerald-500/50 hover:to-teal-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-emerald-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Mis Solicitudes
                  </span>
                </Link>
                <Link
                  href="/movimientos-bancarios"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-amber-500/30 to-orange-600/30 hover:from-amber-500/50 hover:to-orange-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-amber-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Movimientos Bancarios
                  </span>
                </Link>
                <Link
                  href="/monitoreo-cartera"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-purple-500/30 to-violet-600/30 hover:from-purple-500/50 hover:to-violet-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-purple-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Monitoreo Cartera
                  </span>
                </Link>
                <Link
                  href="/monitoreo-facturas"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-red-500/30 to-pink-600/30 hover:from-red-500/50 hover:to-pink-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-red-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Facturacion 
                  </span>
                </Link>
                <Link
                  href="/simulador-proyecciones"
                  className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-cyan-500/30 to-sky-600/30 hover:from-cyan-500/50 hover:to-sky-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-cyan-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px]"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                    Simulador de Proyecciones
                  </span>
                </Link>
                {userData?.categoria && ['Administrador', 'Gerencia', 'Desarrollador'].includes(userData.categoria) && (
                  <Link
                    href="/monitoreo-solicitudes"
                    className="group inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-rose-500/30 to-fuchsia-600/30 hover:from-rose-500/50 hover:to-fuchsia-600/50 transition-all duration-300 transform hover:scale-105 backdrop-blur-md border border-rose-300/40 shadow-xl drop-shadow-lg min-h-[60px] sm:min-h-[70px] sm:col-span-2 lg:col-span-1 lg:col-start-2"
                  >
                    <span className="group-hover:scale-105 transition-transform duration-200 text-center">
                      Monitoreo de Solicitudes
                    </span>
                  </Link>
                )}
              </div>
            ) : (
              // Mostrar formulario de login o botón para acceder
              showLogin ? (
                <LoginComponent 
                  onLoginSuccess={handleLoginSuccess}
                  onBack={() => setShowLogin(false)}
                />
              ) : (
                <div className="bg-blue-500/20 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30">
                  <h3 className="text-white text-xl font-semibold mb-4">Sistema de Gestión Financiera</h3>
                  <p className="text-white/80 mb-6">
                    Acceda al sistema para gestionar solicitudes de compra y monitoreo financiero
                  </p>
                  <button
                    onClick={() => setShowLogin(true)}
                    data-login-trigger
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl drop-shadow-lg"
                  >
                    Acceder al Sistema
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
