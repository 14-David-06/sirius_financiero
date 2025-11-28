import React, { useState, useEffect, useCallback } from 'react';
import { Employee, AirtableField } from '../types/compras';
import { useAuthSession } from '@/lib/hooks/useAuthSession';

interface SolicitudCompraData {
  nombreSolicitante: string;
  areaSolicitante: string;
  cargoSolicitante: string;
  hasProvider: 'si' | 'no';
  prioridadSolicitud: 'Alta' | 'Media' | 'Baja';
  items: Array<{
    objeto: string;
    centroCostos: string;
    cantidad: number;
    valorItem: number;
    compraServicio: 'Compras (Generales)';
    prioridad: 'Alta' | 'Media' | 'Baja';
    fechaRequerida?: string;
    justificacion?: string;
  }>;
  razonSocialProveedor?: string;
  descripcionTranscripcion?: string;
  // descripcionIAInterpretacion?: string; // Campo computado en Airtable
  cotizacionDoc?: string; // Para el archivo de cotización
}

interface ItemData {
  id: number;
  objeto: string;
  centroCosto: string;
  cantidad: number;
  valorEstimado: number;
  fechaRequerida: string;
  prioridad: string;
  justificacion: string;
}

export default function SolicitudesCompra() {
  const [selectedUser, setSelectedUser] = useState('');
  const [otroNombre, setOtroNombre] = useState('');
  const [otroArea, setOtroArea] = useState('');
  const [otroCargo, setOtroCargo] = useState('');
  const [hasProvider, setHasProvider] = useState(''); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [priority, setPriority] = useState('Media'); // Valor por defecto: Media
  const [items, setItems] = useState<ItemData[]>([]);
  const [itemCounter, setItemCounter] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para empleados desde la base de datos
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  
  // Estados para grabación de audio y transcripción
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscription, setAudioTranscription] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Estados para archivo de cotización
  const [cotizacionFile, setCotizacionFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [cotizacionAttachment, setCotizacionAttachment] = useState<AirtableField | null>(null);
  
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  
  const costCentersByArea = {
    "Laboratorio": ["Hongos", "Bacterias", "Análisis"],
    "Pirolisis": ["Mantenimiento", "Novedades", "Blend"],
    "Administrativo": ["Administración", "Mercadeo", "Otros Gastos ADM"],
    "RAAS": ["Tecnología", "Equipos Tecnológicos"],
    "Gestión del Ser": ["Administración", "Mercadeo", "Otros Gastos ADM"],
    "SST": ["Administración", "Mercadeo", "Otros Gastos ADM"]
  };

  // Datos de usuario de respaldo (fallback) - mantener para compatibilidad
  const datosUsuario = {
    "Santiago Amaya": { area: "Pirolisis", cargo: "Jefe de Planta" },
    "Luisa Ramirez": { area: "Laboratorio", cargo: "Coordinadora Líder" },
    "Katherin Roldan": { area: "SST", cargo: "Líder de SST" },
    "Yesenia Ramirez": { area: "Laboratorio", cargo: "Auxiliar de Laboratorio" },
    "Carolina Casas": { area: "Administrativo", cargo: "Auxiliar Administrativo y Contable" },
    "Juan Manuel": { area: "Administrativo", cargo: "CMO" },
    "Pablo Acebedo": { area: "RAAS", cargo: "CTO" }
  };

  // Función para cargar empleados desde la API
  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      setEmployeesError(null);
      
      const response = await fetch('/api/get-employees');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar empleados');
      }
      
      if (data.success && data.employees) {
        setEmployees(data.employees);
        console.log(`Cargados ${data.employees.length} empleados desde la base de datos`);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error cargando empleados:', error);
      setEmployeesError(error instanceof Error ? error.message : 'Error desconocido');
      // En caso de error, usar datos de respaldo
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // Funciones para manejar grabación de audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        transcribeAudio(audioBlob);
        
        // Detener el stream para liberar el micrófono
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accediendo al micrófono:', error);
      alert('Error accediendo al micrófono. Verifique los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setAudioTranscription(result.transcription);
      } else {
        console.error('Error en transcripción:', result.error);
        alert('Error al transcribir el audio: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error transcribiendo audio:', error);
      alert('Error al transcribir el audio. Inténtelo de nuevo.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearAudioTranscription = () => {
    setAudioBlob(null);
    setAudioTranscription('');
  };

  // Funciones para manejar archivos de cotización
  const handleFileUpload = async (file: File) => {
    setIsUploadingFile(true);
    try {
      // Obtener información del proveedor y solicitante
      const proveedorNombre = (document.querySelector('input[name="Proveedor_Nombre"]') as HTMLInputElement)?.value || 'SinProveedor';
      const solicitanteNombre = selectedUser !== "otro" ? selectedUser : otroNombre || 'SinNombre';
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('proveedorNombre', proveedorNombre);
      formData.append('solicitanteNombre', solicitanteNombre);

      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCotizacionAttachment({
          id: result.fileId || crypto.randomUUID(),
          url: result.fileUrl,
          filename: result.fileName,
          type: file.type,
          size: file.size
        });
        setCotizacionFile(file);
        console.log('Archivo subido exitosamente a S3:', result.fileUrl);
      } else {
        console.error('Error subiendo archivo:', result.error);
        alert('Error al subir el archivo: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      alert('Error al subir el archivo. Inténtelo de nuevo.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const clearCotizacionFile = () => {
    setCotizacionFile(null);
    setCotizacionAttachment(null);
  };

  // Efecto para cargar empleados al montar el componente
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Efecto para establecer el usuario por defecto como el usuario logueado
  // Ahora fijamos siempre el solicitante al usuario logueado (si existe)
  useEffect(() => {
    if (userData?.nombre && selectedUser !== userData.nombre) {
      setSelectedUser(userData.nombre);
    }
  }, [userData?.nombre, selectedUser]);

  const getUserData = (username: string) => {
    // Buscar primero en los empleados cargados desde la base de datos
    const employee = employees.find(emp => emp.name === username);
    if (employee) {
      return { area: employee.area, cargo: employee.cargo };
    }
    
    // Si no se encuentra, usar datos de respaldo
    return datosUsuario[username as keyof typeof datosUsuario] || { area: "", cargo: "" };
  };

  // Función para obtener la lista completa de empleados para el select
  const getEmployeeOptions = () => {
    if (employees.length > 0) {
      return employees;
    }
    
    // Fallback: convertir datos de respaldo al formato de Employee
    return Object.entries(datosUsuario).map(([name, data]) => ({
      id: name,
      name: name,
      cedula: '',
      cargo: data.cargo,
      area: data.area
    }));
  };

  const getCostCenters = () => {
    if (selectedUser === "otro") {
      // Si es otro usuario y tiene área especificada, usar centros de costo de esa área
      if (otroArea && costCentersByArea[otroArea as keyof typeof costCentersByArea]) {
        return costCentersByArea[otroArea as keyof typeof costCentersByArea];
      }
      // Si no tiene área o no es válida, mostrar todos los centros de costo
      return Object.values(costCentersByArea).flat();
    }
    const userData = getUserData(selectedUser);
    return costCentersByArea[userData.area as keyof typeof costCentersByArea] || [];
  };

  const addItem = () => {
    const newId = itemCounter + 1;
    const newItem: ItemData = {
      id: newId,
      objeto: '',
      centroCosto: getCostCenters()[0] || '',
      cantidad: 0, // Empieza en 0 para mostrar campo vacío
      valorEstimado: 0, // Empieza en 0 para mostrar campo vacío
      fechaRequerida: '',
      prioridad: 'Media',
      justificacion: ''
    };
    setItems([...items, newItem]);
    setItemCounter(newId);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: keyof ItemData, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Validar datos requeridos
      if (!selectedUser && !otroNombre) {
        throw new Error('Debe seleccionar un solicitante');
      }

      // VALIDACIONES DE ITEMS - TEMPORALMENTE DESHABILITADAS
      /* if (items.length === 0) {
        throw new Error('Debe agregar al menos un item');
      }

      // Validar que todos los items tengan cantidad y precio
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.objeto.trim()) {
          throw new Error(`El item ${i + 1} debe tener una descripción`);
        }
        if (item.cantidad <= 0) {
          throw new Error(`El item ${i + 1} debe tener una cantidad mayor a 0`);
        }
        if (item.valorEstimado <= 0) {
          throw new Error(`El item ${i + 1} debe tener un precio mayor a 0`);
        }
      } */

      // Obtener datos del usuario
      const userData = selectedUser !== 'otro' ? getUserData(selectedUser) : { area: '', cargo: '' };
      const nombreSolicitante = selectedUser !== 'otro' ? selectedUser : otroNombre;

      // Preparar datos para la API - SOLO DATOS BÁSICOS TEMPORALMENTE
      const solicitudData: SolicitudCompraData = {
        // Datos del solicitante
        nombreSolicitante: nombreSolicitante,
        areaSolicitante: userData.area || (selectedUser === 'otro' ? otroArea : 'Sin especificar'),
        cargoSolicitante: userData.cargo || (selectedUser === 'otro' ? otroCargo : 'Sin especificar'),
        
        // Datos de la solicitud básicos
        hasProvider: 'no', // Temporal: sin proveedor
        prioridadSolicitud: priority as 'Alta' | 'Media' | 'Baja',
        
        // Items vacío temporalmente - se mantendrá la estructura pero sin datos
        items: [] // Array vacío temporal
      };

      // SECCIÓN TEMPORALMENTE DESHABILITADA - MANEJO DE ITEMS Y PROVEEDORES
      /* 
        // Items de compra
        items: items.map(item => ({
          objeto: item.objeto,
          centroCostos: item.centroCosto,
          cantidad: item.cantidad,
          valorItem: item.valorEstimado,
          compraServicio: 'Compras (Generales)' as const, // Por defecto, puede ser configurable
          prioridad: item.prioridad as 'Alta' | 'Media' | 'Baja',
          fechaRequerida: item.fechaRequerida || undefined,
          justificacion: item.justificacion || undefined
        }))

      // Agregar información del proveedor si existe
      const formData = new FormData(e.target as HTMLFormElement);
      if (hasProvider === 'si') {
        const proveedorNombre = formData.get('Proveedor_Nombre') as string;
        if (proveedorNombre) {
          solicitudData.razonSocialProveedor = proveedorNombre;
        }
        
        // Agregar archivo de cotización si existe
        if (cotizacionAttachment) {
          solicitudData.cotizacionDoc = cotizacionAttachment.url;
        }
      }

      // Generar descripción básica de los items para IA
      const descripcionItems = items.map((item, index) => 
        `${index + 1}. ${item.objeto} - Cantidad: ${item.cantidad} - Valor: $${item.valorEstimado.toLocaleString()}`
      ).join('\n');
      */
      
      // Enviar la transcripción por separado
      if (audioTranscription.trim()) {
        solicitudData.descripcionTranscripcion = audioTranscription;
      }
      
      // SECCIÓN TEMPORALMENTE DESHABILITADA - DESCRIPCIÓN IA CON ITEMS
      /* 
      // Combinar descripción del usuario con transcripción de audio y descripción de items para IA
      let descripcionCompleta = '';
      
      if (audioTranscription.trim()) {
        descripcionCompleta += `Descripción de la solicitud:\n${audioTranscription}\n\n`;
      }
      
      descripcionCompleta += `Items solicitados:\n${descripcionItems}`;
      
      // solicitudData.descripcionIAInterpretacion = descripcionCompleta; // Campo computado en Airtable
      */

      // Por ahora, solo usar la transcripción como descripción (sin IA)
      // if (audioTranscription.trim()) {
      //   solicitudData.descripcionIAInterpretacion = audioTranscription; // Campo computado en Airtable
      // }

      // Debug logs solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Enviando solicitud a API local:', solicitudData);
      }
      
      // Enviar a la API local
      const response = await fetch('/api/solicitudes-compra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(solicitudData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Error al procesar la solicitud');
      }
      
      if (result.success) {
        // Mostrar mensaje de éxito
        showSuccessAnimation(result.data);
        
        // Debug logs solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Solicitud creada exitosamente:', result.data);
        }
        
        // Reset form después de 2 segundos
        setTimeout(() => {
          setSelectedUser('');
          setOtroNombre('');
          setOtroArea('');
          setOtroCargo('');
          setHasProvider('');
          setPriority('Media'); // Reset a valor por defecto
          setItems([]);
          setItemCounter(0);
          
          // Limpiar campos de audio
          setAudioTranscription('');
          setAudioBlob(null);
          setIsRecording(false);
          setIsTranscribing(false);
          
          // Limpiar campos de archivo
          setCotizacionFile(null);
          setCotizacionAttachment(null);
          setIsUploadingFile(false);
          
          // Limpiar formulario HTML
          (e.target as HTMLFormElement).reset();
        }, 2000);
      } else {
        throw new Error(result.message || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('Error al enviar la solicitud:', error);
      
      // Mostrar error al usuario
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar la solicitud';
      
      // Crear elemento de error temporal
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 20px 30px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
          z-index: 10000;
          text-align: center;
          max-width: 400px;
          animation: errorSlideIn 0.3s ease-out;
        ">
          <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">Error al enviar solicitud</div>
          <div style="font-size: 14px; opacity: 0.9;">${errorMessage}</div>
        </div>
      `;

      // Agregar estilos para la animación de error
      const errorStyle = document.createElement('style');
      errorStyle.textContent = `
        @keyframes errorSlideIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `;
      document.head.appendChild(errorStyle);
      
      document.body.appendChild(errorDiv);
      
      setTimeout(() => {
        errorDiv.remove();
        errorStyle.remove();
      }, 5000);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para mostrar animación de éxito
  const showSuccessAnimation = (data?: { id?: string; [key: string]: unknown }) => {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white p-12 rounded-3xl shadow-2xl text-center border-4 border-green-500 max-w-md';
    successDiv.style.animation = 'successPop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    
    let innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
      <h3 style="color: #10b981; margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: bold;">¡Solicitud Enviada!</h3>
      <p style="color: #64748b; margin-bottom: 1rem;">Tu solicitud ha sido procesada correctamente</p>
    `;
    
    if (data) {
      innerHTML += `
        <div style="text-align: left; background-color: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem;">
          <p style="margin: 0.25rem 0;"><strong>ID:</strong> ${data.solicitudId || 'N/A'}</p>
          <p style="margin: 0.25rem 0;"><strong>Items:</strong> ${data.itemsCreados || 0}</p>
          <p style="margin: 0.25rem 0;"><strong>Total:</strong> $${data.valorTotal?.toLocaleString() || '0'}</p>
        </div>
      `;
      
      if (data.pdfUrl) {
        innerHTML += `
          <div style="margin-top: 1rem;">
            <a href="${data.pdfUrl}" target="_blank" 
               style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 0.875rem; font-weight: bold;">
              📄 Descargar PDF
            </a>
          </div>
        `;
      }
    }
    
    successDiv.innerHTML = innerHTML;
    
    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes successPop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.3);
        }
        100% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
      style.remove();
    }, 3000);
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
      }}
    >
      <div className="min-h-screen flex flex-col justify-center py-20 px-4 pt-32">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
              Solicitud de Compras – Sirius
            </h2>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* User Selection */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    Nombre del Solicitante
                  </label>
                  {loadingEmployees ? (
                    <div className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white/70 backdrop-blur-sm">
                      Cargando empleados...
                    </div>
                  ) : (
                    // Si el usuario está autenticado, fijamos el dropdown al usuario logueado
                    (isAuthenticated && userData?.nombre) ? (
                      <select
                        value={selectedUser}
                        disabled
                        className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300 opacity-80 cursor-not-allowed"
                        required
                      >
                        <option value={selectedUser} className="text-gray-900 bg-white">
                          {selectedUser} - {getUserData(selectedUser).cargo} ({getUserData(selectedUser).area})
                        </option>
                      </select>
                    ) : (
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                        required
                      >
                        <option value="" className="text-gray-900 bg-white">Seleccione un usuario</option>
                        {getEmployeeOptions().map(employee => (
                          <option key={employee.id} value={employee.name} className="text-gray-900 bg-white">
                            {employee.name} - {employee.cargo} ({employee.area})
                          </option>
                        ))}
                        <option value="otro" className="text-gray-900 bg-white">Otro Usuario</option>
                      </select>
                    )
                  )}
                  {employeesError && (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-yellow-300 text-sm">
                        ⚠️ {employeesError} - Usando datos de respaldo
                      </p>
                      <button
                        type="button"
                        onClick={loadEmployees}
                        className="text-blue-300 hover:text-blue-200 text-sm underline"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
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
                    value={selectedUser !== "otro" ? getUserData(selectedUser).area : otroArea}
                    onChange={selectedUser === "otro" ? (e) => setOtroArea(e.target.value) : undefined}
                    readOnly={selectedUser !== "otro"}
                    placeholder={selectedUser === "otro" ? "Escriba el área del solicitante" : ""}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    Cargo del Solicitante
                  </label>
                  <input
                    type="text"
                    value={selectedUser !== "otro" ? getUserData(selectedUser).cargo : otroCargo}
                    onChange={selectedUser === "otro" ? (e) => setOtroCargo(e.target.value) : undefined}
                    readOnly={selectedUser !== "otro"}
                    placeholder={selectedUser === "otro" ? "Escriba el cargo del solicitante" : ""}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    required
                  />
                </div>
              </div>

              {/* Request Description Section */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white drop-shadow-lg flex items-center">
                  📝 Descripción de la Solicitud
                  <div className="flex-1 ml-4 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 opacity-60"></div>
                </h3>
                
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 space-y-4">
                  <p className="text-white/80 text-sm">
                    Agregue una descripción detallada de su solicitud. Puede escribir directamente o grabar un mensaje de voz que será transcrito automáticamente.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={isTranscribing}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-lg">🎤</span>
                        Grabar Descripción
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-6 py-3 bg-red-800 hover:bg-red-900 text-white rounded-2xl font-semibold transition-all duration-300 animate-pulse"
                      >
                        <span className="text-lg">⏹️</span>
                        Detener Grabación
                      </button>
                    )}
                    
                    {audioBlob && (
                      <button
                        type="button"
                        onClick={clearAudioTranscription}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all duration-300"
                      >
                        🗑️ Limpiar
                      </button>
                    )}
                    
                    {isTranscribing && (
                      <div className="flex items-center gap-2 text-white">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Transcribiendo...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-white font-semibold text-sm">
                      Descripción de la solicitud:
                    </label>
                    <textarea
                      value={audioTranscription}
                      onChange={(e) => setAudioTranscription(e.target.value)}
                      placeholder="Escriba aquí la descripción de su solicitud o utilice el botón de grabación para dictar..."
                      className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300 min-h-[120px] resize-vertical"
                    />
                  </div>
                </div>
              </div>

              {/* Priority Section */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                    ⚡ Prioridad Solicitud
                  </label>
                  <select
                    name="Prioridad_Solicitud"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                    required
                  >
                    <option value="Alta" className="text-gray-900 bg-white">🔴 Alta</option>
                    <option value="Media" className="text-gray-900 bg-white">🟡 Media</option>
                    <option value="Baja" className="text-gray-900 bg-white">🟢 Baja</option>
                  </select>
                </div>
              </div>

              {/* ITEMS SECTION - TEMPORALMENTE OCULTA */}
              {/* <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white drop-shadow-lg flex items-center">
                  📝 Ítems Solicitados
                  <div className="flex-1 ml-4 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 opacity-60"></div>
                </h3>
                
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-3xl"></div>
                      
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
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
                            name={`item_name_${item.id}`}
                            placeholder="Especifique el ítem solicitado"
                            value={item.objeto}
                            onChange={(e) => updateItem(item.id, 'objeto', e.target.value)}
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
                            name={`item_quantity_${item.id}`}
                            min="1"
                            placeholder="Ingrese cantidad"
                            value={item.cantidad === 0 ? '' : item.cantidad}
                            onChange={(e) => updateItem(item.id, 'cantidad', parseInt(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Precio Estimado Por Unidad
                          </label>
                          <input
                            type="number"
                            name={`item_price_${item.id}`}
                            min="0"
                            step="0.01"
                            placeholder="Ingrese precio"
                            value={item.valorEstimado === 0 ? '' : item.valorEstimado}
                            onChange={(e) => updateItem(item.id, 'valorEstimado', parseFloat(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2 drop-shadow-md">
                            Centro de Costo
                          </label>
                          <select
                            name={`item_cost_center_${item.id}`}
                            value={item.centroCosto}
                            onChange={(e) => updateItem(item.id, 'centroCosto', e.target.value)}
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
              </div> */}
              {/* FIN ITEMS SECTION - TEMPORALMENTE OCULTA */}

              {/* PROVIDER SECTION - TEMPORALMENTE OCULTA */}
              {/* <div className="space-y-6">
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
                        name="Proveedor_Nombre"
                        placeholder="Ingrese el nombre del proveedor"
                        className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-3 text-lg drop-shadow-md">
                        Cotización (PDF/IMG)
                      </label>
                      
                      {!cotizacionFile ? (
                        <div className="space-y-3">
                          <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,image/*"
                            disabled={isUploadingFile}
                            className="w-full p-4 bg-white/15 border-2 border-dashed border-white/30 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-white file:bg-blue-500 hover:file:bg-blue-600 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300 disabled:opacity-50"
                          />
                          {isUploadingFile && (
                            <div className="flex items-center gap-2 text-white/80 text-sm">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Subiendo archivo...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {cotizacionFile.type.includes('pdf') ? '📄' : '🖼️'}
                              </span>
                              <div>
                                <p className="text-white font-medium">{cotizacionFile.name}</p>
                                <p className="text-white/70 text-sm">
                                  {(cotizacionFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={clearCotizacionFile}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all duration-300"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div> */}
              {/* FIN PROVIDER SECTION - TEMPORALMENTE OCULTA */}

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
