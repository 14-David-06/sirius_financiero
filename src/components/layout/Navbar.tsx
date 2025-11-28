'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import BitacoraNavbar from '../BitacoraNavbar';
import { LogOut, User, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, userData, logout } = useAuthSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar menú móvil al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMenuOpen && !target.closest('.mobile-menu-container') && !target.closest('.menu-button')) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Evitar problemas de hidratación
  if (!mounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Image 
                  src="/Logo-Sirius.png" 
                  alt="Sirius Financiero Logo" 
                  width={180}
                  height={70}
                  className="object-contain transition-transform duration-200"
                  priority
                  sizes="180px"
                />
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <div className="w-8 h-8"></div>
            </div>
            <div className="md:hidden">
              <div className="w-8 h-8"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const toggleDropdown = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const closeDropdowns = () => {
    setActiveDropdown(null);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo y Bitácora */}
          <div className="flex items-center space-x-12">
            <Link href="/" className="flex items-center space-x-2" onClick={() => window.location.href = '/'}>
              <Image 
                src="/Logo-Sirius.png" 
                alt="Sirius Financiero Logo" 
                width={180}
                height={70}
                className="object-contain transition-transform duration-200"
                priority
                sizes="180px"
              />
            </Link>
            
            {/* Bitácora al lado del logo - Desktop y Mobile */}
            {isAuthenticated && (
              <BitacoraNavbar userData={userData} />
            )}
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                {/* Compras y Solicitudes */}
                <div className="relative">
                  <button
                    onClick={() => toggleDropdown('compras')}
                    className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                  >
                    <span>Compras</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {activeDropdown === 'compras' && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                      <Link
                        href="/solicitudes-compra"
                        className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                        onClick={closeDropdowns}
                      >
                        <span className="group-hover:translate-x-1 transition-transform duration-200">Solicitudes de Compra</span>
                      </Link>
                      <Link
                        href="/mis-solicitudes-compras"
                        className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                        onClick={closeDropdowns}
                      >
                        <span className="group-hover:translate-x-1 transition-transform duration-200">Mis Solicitudes de Compras</span>
                      </Link>
                      {/* Mostrar opciones adicionales solo para no colaboradores */}
                      {userData?.categoria !== 'Colaborador' && (
                        <>
                          <Link
                            href="/monitoreo-solicitudes"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Monitoreo de solicitudes</span>
                          </Link>
                          <Link
                            href="/caja-menor"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Caja Menor</span>
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Mostrar menús adicionales solo para no colaboradores */}
                {userData?.categoria !== 'Colaborador' && (
                  <>
                    {/* Finanzas */}
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown('finanzas')}
                        className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                      >
                        <span>Finanzas</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {activeDropdown === 'finanzas' && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-gradient-to-br from-emerald-900/95 to-cyan-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                          <Link
                            href="/movimientos-bancarios"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Movimientos Bancarios</span>
                          </Link>
                          <Link
                            href="/indicadores-produccion"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Análisis de Costos y Precios de Referencia</span>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Proyecciones */}
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown('proyecciones')}
                        className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                      >
                        <span>Proyecciones</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {activeDropdown === 'proyecciones' && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-gradient-to-br from-green-900/95 to-teal-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                          <Link
                            href="/simulador-proyecciones"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Simulador de Proyecciones</span>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Resumen Gerencial */}
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown('resumen')}
                        className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                      >
                        <span>Resumen Gerencial</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {activeDropdown === 'resumen' && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-gradient-to-br from-amber-900/95 to-orange-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                          <Link
                            href="/resumen-gerencial"
                            className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                            onClick={closeDropdowns}
                          >
                            <span className="group-hover:translate-x-1 transition-transform duration-200">Dashboard Ejecutivo</span>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Airtable Logo */}
                    <div className="flex items-center">
                      <a
                        href="https://airtable.com/appBNCVj4Njbyu1En/tbluOb37XJkZeNDT7/viwlwwuAOmEiPsOVJ?blocks=hide"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:scale-105 transition-transform duration-200"
                      >
                        <Image
                          src="/logo_airtable.webp"
                          alt="Airtable"
                          width={50}
                          height={32}
                          className="object-contain opacity-80 hover:opacity-100 transition-opacity duration-200"
                        />
                      </a>
                    </div>
                  </>
                )}

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
                  // Usar localStorage para indicar que se debe mostrar login
                  localStorage.setItem('showLogin', 'true');
                  window.location.href = '/';
                }}
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl drop-shadow-lg"
              >
                Acceder al Sistema
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="menu-button text-white hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 rounded-md p-2"
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
        <div className="md:hidden fixed inset-x-0 top-20 z-40 animate-in slide-in-from-top-2 duration-300">
          <div className="mobile-menu-container mx-4 mt-2 bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20">
            <div className="px-4 pt-4 pb-2 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {isAuthenticated ? (
                <>
                  {/* User Info Mobile */}
                  <div className="px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 mb-4">
                    <p className="text-white font-semibold text-base">{userData?.nombre}</p>
                    <p className="text-white/80 text-sm">{userData?.categoria}</p>
                    <p className="text-white/60 text-xs">Cédula: {userData?.cedula}</p>
                  </div>

                  {/* Compras Section */}
                  <div className="space-y-2">
                    <div className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-800/30 to-blue-700/30 rounded-xl">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                      <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wider">Compras</h3>
                    </div>
                    <Link
                      href="/solicitudes-compra"
                      className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">Solicitudes de Compra</span>
                    </Link>
                    <Link
                      href="/mis-solicitudes-compras"
                      className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">Mis Solicitudes de Compras</span>
                    </Link>
                    {/* Mostrar opciones adicionales solo para no colaboradores */}
                    {userData?.categoria !== 'Colaborador' && (
                      <>
                        <Link
                          href="/monitoreo-solicitudes"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Monitoreo de solicitudes</span>
                        </Link>
                        <Link
                          href="/caja-menor"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Caja Menor</span>
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Mostrar secciones adicionales solo para no colaboradores */}
                  {userData?.categoria !== 'Colaborador' && (
                    <>
                      {/* Finanzas Section */}
                      <div className="space-y-2">
                        <div className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-800/30 to-emerald-700/30 rounded-xl">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                          <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wider">Finanzas</h3>
                        </div>
                        <Link
                          href="/movimientos-bancarios"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Movimientos Bancarios</span>
                        </Link>
                        <Link
                          href="/indicadores-produccion"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Análisis de Costos y Precios de Referencia</span>
                        </Link>
                      </div>

                      {/* Proyecciones Section */}
                      <div className="space-y-2">
                        <div className="flex items-center px-4 py-2 bg-gradient-to-r from-green-800/30 to-green-700/30 rounded-xl">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                          <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wider">Proyecciones</h3>
                        </div>
                        <Link
                          href="/simulador-proyecciones"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Simulador de Proyecciones</span>
                        </Link>
                      </div>

                      {/* Resumen Gerencial Section */}
                      <div className="space-y-2">
                        <div className="flex items-center px-4 py-2 bg-gradient-to-r from-amber-800/30 to-amber-700/30 rounded-xl">
                          <div className="w-2 h-2 bg-amber-400 rounded-full mr-3"></div>
                          <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wider">Resumen Gerencial</h3>
                        </div>
                        <Link
                          href="/resumen-gerencial"
                          className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                          <span className="group-hover:translate-x-1 transition-transform duration-200">Dashboard Ejecutivo</span>
                        </Link>
                      </div>

                      {/* Airtable Logo Mobile */}
                      <div className="flex justify-center py-4">
                        <a
                          href="https://airtable.com/appBNCVj4Njbyu1En/tbluOb37XJkZeNDT7/viwlwwuAOmEiPsOVJ?blocks=hide"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20 hover:bg-white/15 transition-all duration-300"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <Image
                            src="/logo_airtable.webp"
                            alt="Airtable"
                            width={24}
                            height={24}
                            className="object-contain opacity-80"
                          />
                          <span className="text-white/80 text-sm font-medium">Ver en Airtable</span>
                        </a>
                      </div>
                    </>
                  )}

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-white/20">
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="group flex items-center w-full text-red-300 hover:text-red-200 hover:bg-red-500/20 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-transparent hover:border-red-400/30"
                    >
                      <LogOut className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform duration-200" />
                      <span className="group-hover:translate-x-1 transition-transform duration-200">Cerrar Sesión</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={() => {
                      localStorage.setItem('showLogin', 'true');
                      window.location.href = '/';
                      setIsMenuOpen(false);
                    }}
                    className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl"
                  >
                    Acceder al Sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
