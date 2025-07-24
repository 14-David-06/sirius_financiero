'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="/logo.png" 
              alt="Sirius Financiero Logo" 
              width={144}
              height={112}
              className="object-contain"
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/solicitudes-compra"
              className="text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
            >
              Solicitudes de Compra
            </Link>
            <Link
              href="/monitoreo-solicitudes"
              className="text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
            >
              Monitoreo de Solicitudes
            </Link>
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
            <Link
              href="/solicitudes-compra"
              className="text-white/90 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Solicitudes de Compra
            </Link>
            <Link
              href="/monitoreo-solicitudes"
              className="text-white/90 hover:text-white hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Monitoreo de Solicitudes
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
