'use client';

import { useState, useEffect } from 'react';
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
      <section className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto min-h-[calc(100vh-5rem)] flex flex-col justify-center items-center">
          <div className="text-center w-full">
            {/* Header Card */}
            {!showLogin && (
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/20 shadow-2xl">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
                  Sirius Financiero
                </h1>
                <p className="text-xl md:text-2xl lg:text-3xl text-white/90 max-w-3xl mx-auto drop-shadow-md">
                  Plataforma integral para la gestión de solicitudes de compra y monitoreo financiero empresarial
                </p>
                {isAuthenticated && userData && (
                  <div className="bg-green-500/20 backdrop-blur-md rounded-2xl p-6 mt-8 border border-green-500/30">
                    <p className="text-white/90 text-xl md:text-2xl">
                      ¡Bienvenido, <strong>{userData.nombre}</strong>!
                    </p>
                    <p className="text-white/70 text-base md:text-lg mt-2">
                      {userData.categoria} • Sesión activa
                    </p>
                    <p className="text-white/60 text-sm md:text-base mt-4">
                      Utiliza el menú de navegación para acceder a todas las funcionalidades del sistema
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Login Section */}
            {!isAuthenticated && (
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
