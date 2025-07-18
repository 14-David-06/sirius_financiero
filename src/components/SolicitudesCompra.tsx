'use client';

import { useState, useRef, useEffect } from 'react';

interface AudioRecorder {
  isRecording: boolean;
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  startTime: number | null;
  timerInterval: NodeJS.Timeout | null;
  chunks: Blob[];
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  microphone: MediaStreamAudioSourceNode | null;
  dataArray: Uint8Array | null;
  animationId: number | null;
}

export default function SolicitudesCompra() {
  const [selectedUser, setSelectedUser] = useState('');
  const [otroNombre, setOtroNombre] = useState('');
  const [hasProvider, setHasProvider] = useState('');
  const [items, setItems] = useState<number[]>([]);
  const [itemCounter, setItemCounter] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const audioRecorderRef = useRef<AudioRecorder>({
    isRecording: false,
    mediaRecorder: null,
    stream: null,
    startTime: null,
    timerInterval: null,
    chunks: [],
    audioContext: null,
    analyser: null,
    microphone: null,
    dataArray: null,
    animationId: null
  });

  const costCentersByArea = {
    "Laboratorio": ["Hongos", "Bacterias", "Análisis"],
    "Pirolisis": ["Mantenimiento", "Novedades", "Blend"],
    "Administrativo": ["Administración", "Mercadeo", "Otros Gastos ADM"],
    "RAAS": ["Tecnología", "Equipos Tecnológicos"],
    "Gestión del Ser": ["Administración", "Mercadeo", "Otros Gastos ADM"],
    "SST": ["Administración", "Mercadeo", "Otros Gastos ADM"]
  };

  const datosUsuario = {
    "Santiago Amaya": { area: "Pirolisis", cargo: "Jefe de Planta" },
    "Luisa Ramirez": { area: "Gestión del Ser", cargo: "Coordinadora Líder de Gestión del Ser" },
    "Katherin Roldan": { area: "SST", cargo: "Líder de SST" },
    "Yesenia Ramirez": { area: "Laboratorio", cargo: "Auxiliar de Laboratorio" },
    "Carolina Casas": { area: "Administrativo", cargo: "Auxiliar Administrativo y Contable" },
    "Juan Manuel": { area: "Administrativo", cargo: "CMO" },
    "Pablo Acebedo": { area: "RAAS", cargo: "CTO" }
  };

  const getUserData = (username: string) => {
    return datosUsuario[username as keyof typeof datosUsuario] || { area: "", cargo: "" };
  };

  const getCostCenters = () => {
    if (selectedUser === "otro") {
      return Object.values(costCentersByArea).flat();
    }
    const userData = getUserData(selectedUser);
    return costCentersByArea[userData.area as keyof typeof costCentersByArea] || [];
  };

  const addItem = () => {
    const newId = itemCounter + 1;
    setItems([...items, newId]);
    setItemCounter(newId);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Aquí iría la lógica de envío
    try {
      // Simular envío
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mostrar mensaje de éxito
      alert('¡Solicitud enviada exitosamente!');
      
      // Reset form
      setSelectedUser('');
      setOtroNombre('');
      setHasProvider('');
      setItems([]);
      setItemCounter(0);
      
    } catch (error) {
      alert('Error al enviar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752165981/20032025-DSCF8381_2_1_jzs49t.jpg)'
      }}
    >
      <div className="min-h-screen flex flex-col justify-center py-20 px-4">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/logo.png" 
                alt="Sirius Logo" 
                className="w-12 h-12 object-contain"
              />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
              Solicitud de Compras – Sirius
            </h2>
          </div>

          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl relative overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-3xl"></div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* User Selection Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    Nombre del Solicitante
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    required
                  >
                    <option value="">Seleccione un usuario</option>
                    {Object.keys(datosUsuario).map(name => (
                      <option key={name} value={name} className="text-gray-900 bg-white">
                        {name}
                      </option>
                    ))}
                    <option value="otro" className="text-gray-900 bg-white">Otro Usuario</option>
                  </select>
                </div>

                {selectedUser === "otro" && (
                  <div>
                    <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                      Ingrese Nombre del Usuario
                    </label>
                    <input
                      type="text"
                      value={otroNombre}
                      onChange={(e) => setOtroNombre(e.target.value)}
                      placeholder="Escriba el nombre completo"
                      className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    Área Correspondiente
                  </label>
                  <input
                    type="text"
                    value={selectedUser && selectedUser !== "otro" ? getUserData(selectedUser).area : ""}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    readOnly={selectedUser !== "otro"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    Cargo del Solicitante
                  </label>
                  <input
                    type="text"
                    value={selectedUser && selectedUser !== "otro" ? getUserData(selectedUser).cargo : ""}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    readOnly={selectedUser !== "otro"}
                    required
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-md flex items-center">
                  📝 Ítems Solicitados
                  <div className="flex-1 ml-4 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 opacity-60"></div>
                </h3>
                
                <div className="space-y-6">
                  {items.map((itemId) => (
                    <div key={itemId} className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-3xl"></div>
                      
                      <button
                        type="button"
                        onClick={() => removeItem(itemId)}
                        className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-xl font-semibold hover:from-red-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                      >
                        🗑️ Eliminar
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Nombre del Ítem
                          </label>
                          <input
                            type="text"
                            name={`item_name_${itemId}`}
                            placeholder="Especifique el ítem solicitado"
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            name={`item_quantity_${itemId}`}
                            min="1"
                            placeholder="1"
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Precio Estimado
                          </label>
                          <input
                            type="number"
                            name={`item_price_${itemId}`}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Centro de Costo
                          </label>
                          <select
                            name={`item_cost_center_${itemId}`}
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          >
                            <option value="">Seleccione</option>
                            {getCostCenters().map(center => (
                              <option key={center} value={center} className="text-gray-900 bg-white">
                                {center}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm border border-white/20"
                >
                  ➕ Agregar Ítem
                </button>
              </div>

              {/* Provider Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    ¿Cuenta con proveedor?
                  </label>
                  <select
                    value={hasProvider}
                    onChange={(e) => setHasProvider(e.target.value)}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    required
                  >
                    <option value="">Seleccione una opción</option>
                    <option value="si" className="text-gray-900 bg-white">Sí</option>
                    <option value="no" className="text-gray-900 bg-white">No</option>
                  </select>
                </div>

                {hasProvider === "si" && (
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 space-y-4">
                    <div>
                      <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                        Nombre del Proveedor
                      </label>
                      <input
                        type="text"
                        name="provider_name"
                        placeholder="Ingrese el nombre del proveedor"
                        className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                        Cotización (PDF/IMG)
                      </label>
                      <input
                        type="file"
                        name="provider_quote"
                        accept=".pdf,image/*"
                        className="w-full p-4 bg-white/15 border-2 border-dashed border-white/30 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-white file:bg-blue-500 hover:file:bg-blue-600 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Enviando...
                  </div>
                ) : (
                  "📤 Enviar Solicitud"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
