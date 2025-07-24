import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-gray-900/95 backdrop-blur-sm text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Logo y descripción */}
            <div>
              <Image 
                src="/logo.png" 
                alt="Sirius Financiero Logo" 
                width={144}
                height={112}
                className="object-contain"
              />
              <p className="text-gray-300 mb-4 max-w-md">
                Plataforma integral para la gestión financiera empresarial con tecnología avanzada.
              </p>
            </div>

            {/* Enlaces */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Servicios</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/solicitudes-compra" className="text-gray-300 hover:text-white transition-colors">
                    Solicitudes de Compra
                  </Link>
                </li>
                <li>
                  <Link href="/monitoreo-solicitudes" className="text-gray-300 hover:text-white transition-colors">
                    Monitoreo de Solicitudes
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Contacto</h3>
              <p className="text-gray-300">
                adm@siriusregenerative.com
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2025 Sirius Financiero. Todos los derechos reservados.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacidad
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Términos
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
