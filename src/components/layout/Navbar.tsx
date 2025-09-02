'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import SessionIndicator from '../SessionIndicator';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isAuthenticated, userData, logout, extendSession, getRemainingTime } = useAuthSession();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2" onClick={() => window.location.href = '/'}>
            <Image 
              src="/logo.png" 
              alt="Sirius Financiero Logo" 
              width={180}
              height={140}
              className="object-contain hover:scale-105 transition-transform duration-200"
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {isAuthenticated ? (
              <>
                <Link
                  href="/solicitudes-compra"
                  className="text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                >
                  Solicitudes de Compra
                </Link>
                {userData?.categoria && ['Administrador', 'Gerencia', 'Desarrollador'].includes(userData.categoria) && (
                  <Link
                    href="/monitoreo-solicitudes"
                    className="text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                  >
                    Monitoreo de Solicitudes
                  </Link>
                )}
                
                {/* Session Indicator */}
                <SessionIndicator 
                  getRemainingTime={getRemainingTime}
                  extendSession={extendSession}
                  onLogout={logout}
                />

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 rounded-md p-2"
                  >
                    <User className="w-5 h-5" />
                    <span className="hidden lg:block">{userData?.nombre?.split(' ')[0]}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-200/50">
                        <p className="text-sm font-medium text-gray-900">{userData?.nombre}</p>
                        <p className="text-xs text-gray-600">{userData?.categoria}</p>
                        <p className="text-xs text-gray-500">Cédula: {userData?.cedula}</p>
                      </div>
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  window.location.href = '/';
                  // Si hay alguna función global para mostrar login, activarla
                  setTimeout(() => {
                    const loginButton = document.querySelector('[data-login-trigger]') as HTMLButtonElement;
                    if (loginButton) loginButton.click();
                  }, 100);
                }}
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl drop-shadow-lg"
              >
                Acceder al Sistema
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="text-white hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 rounded-md p-2"
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/10 backdrop-blur-md border-t border-white/20">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isAuthenticated ? (
              <>
                {/* User Info Mobile */}
                <div className="px-3 py-2 bg-white/10 rounded-md mb-2">
                  <p className="text-white font-medium text-sm">{userData?.nombre}</p>
                  <p className="text-white/70 text-xs">{userData?.categoria} • {userData?.cedula}</p>
                </div>

                <Link
                  href="/solicitudes-compra"
                  className="text-white/90 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Solicitudes de Compra
                </Link>
                {userData?.categoria && ['Administrador', 'Gerencia', 'Desarrollador'].includes(userData.categoria) && (
                  <Link
                    href="/monitoreo-solicitudes"
                    className="text-white/90 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Monitoreo de Solicitudes
                  </Link>
                )}

                {/* Session Indicator Mobile */}
                <div className="px-3 py-2">
                  <SessionIndicator 
                    getRemainingTime={getRemainingTime}
                    extendSession={extendSession}
                    onLogout={logout}
                  />
                </div>

                {/* Logout Mobile */}
                <button
                  onClick={logout}
                  className="w-full text-left text-red-300 hover:text-red-200 hover:bg-red-500/10 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => window.location.href = '/'}
                className="text-white/90 hover:text-white hover:bg-blue-500/20 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 text-center bg-gradient-to-r from-blue-600/80 to-purple-600/80"
              >
                Acceder al Sistema
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
