import Link from 'next/link';

export default function LandingPage() {
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
            {/* Header Card */}
            <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 mb-12 border border-white/20 shadow-2xl">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
                Sirius Financiero
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
                Plataforma integral para la gestión de solicitudes de compra y monitoreo financiero empresarial
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                href="/solicitudes-compra"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl drop-shadow-lg"
              >
                Solicitudes de Compra
              </Link>
              <Link
                href="/monitoreo-solicitudes"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl text-white bg-white/15 hover:bg-white/25 transition-all duration-300 backdrop-blur-sm border border-white/30 shadow-xl"
              >
                Monitoreo de Solicitudes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
