'use client';

import ValidacionUsuario from './ValidacionUsuario';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { UserData } from '@/types/compras';
import { 
  DollarSign, 
  Plus, 
  Search,
  AlertTriangle, 
  Filter, 
  Download,
  Calendar,
  Receipt,
  User,
  Building,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Mic,
  MicOff
} from 'lucide-react';

interface CajaMenorRecord {
  id: string;
  fechaAnticipo: string;
  beneficiario: string;
  nitCC?: string;
  concepto: string;
  valor: number;
  itemsCajaMenor?: string[]; // Array de IDs de items relacionados
  realizaRegistro?: string; // Nuevo campo: quien realiza el registro
  fechaConsolidacion?: string; // Fecha de consolidación del periodo
  documentoConsolidacion?: AirtableAttachment[]; // Array de attachments del documento de consolidación
  estadoCajaMenor?: string; // Estado: "Caja Menor Consiliada" o "Caja Menor Abierta"
}

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

interface ItemCajaMenor {
  id: string;
  item?: number; // Auto Number
  fecha: string;
  beneficiario: string;
  nitCC?: string;
  concepto: string;
  centroCosto?: string;
  valor: number;
  realizaRegistro?: string;
  cajaMenor?: string[]; // Array de IDs de caja menor relacionados
  comprobante?: AirtableAttachment[]; // Array de attachments
}

function CajaMenorDashboard({ userData, onLogout }: { userData: UserData, onLogout: () => void }) {
  const [cajaMenorRecords, setCajaMenorRecords] = useState<CajaMenorRecord[]>([]);
  const [itemsRecords, setItemsRecords] = useState<ItemCajaMenor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CajaMenorRecord | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showCajaMenorModal, setShowCajaMenorModal] = useState(false);
  const [cajaMenorActual, setCajaMenorActual] = useState<CajaMenorRecord | null>(null);
  const [showConsolidarModal, setShowConsolidarModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  
  // Estados para grabación de audio y transcripción
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Estados para beneficiarios
  const [beneficiarios, setBeneficiarios] = useState<Array<{ nombre: string; nitCC: string }>>([]);
  const [esNuevoBeneficiario, setEsNuevoBeneficiario] = useState(false);

  // Función helper para formatear fechas ISO sin problemas de zona horaria
  const formatearFecha = (fechaISO: string): string => {
    if (!fechaISO) return 'Sin fecha';
    try {
      // Dividir la fecha ISO (YYYY-MM-DD) y crear fecha local
      const [year, month, day] = fechaISO.split('T')[0].split('-');
      const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      if (isNaN(fecha.getTime())) return 'Fecha inválida';
      
      return fecha.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  // Función helper para formatear mes y año desde fecha ISO
  const formatearMesAnio = (fechaISO: string): string => {
    if (!fechaISO) return '';
    try {
      const [year, month] = fechaISO.split('T')[0].split('-');
      const fecha = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      if (isNaN(fecha.getTime())) return '';
      
      return fecha.toLocaleDateString('es-CO', { 
        month: 'long', 
        year: 'numeric' 
      }).toUpperCase();
    } catch {
      return '';
    }
  };

  // Función helper para obtener fecha local en formato YYYY-MM-DD sin offset de timezone
  const obtenerFechaLocal = (): string => {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Datos del formulario para caja menor
  const [formCajaMenor, setFormCajaMenor] = useState({
    beneficiario: '',
    nitCC: '',
    concepto: '',
    valor: 0,
    realizaRegistro: userData?.nombre || 'Usuario'
  });

  // Datos del formulario para items
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    beneficiario: '',
    nitCC: '',
    concepto: '',
    centroCosto: '',
    centroCostoOtro: '',
    valor: '',
    realizaRegistro: userData?.nombre || 'Usuario',
    comprobanteFile: null as File | null
  });

  const categorias = [
    'Transporte',
    'Alimentación',
    'Suministros de Oficina',
    'Servicios Públicos',
    'Mantenimiento',
    'Comunicaciones',
    'Gastos Menores',
    'Otros'
  ];

  const unidadesNegocio = [
    'Pirólisis',
    'Biológicos',
    'RaaS',
    'Administración'
  ];

  useEffect(() => {
    cargarDatos();
  }, []);

  // Memoizar todas las cajas menores activas (no consolidadas)
  const cajasMenoresActivas = useMemo(() => {
    return cajaMenorRecords.filter(record => 
      record.estadoCajaMenor === 'Caja Menor Abierta' || !record.estadoCajaMenor
    );
  }, [cajaMenorRecords]);

  // Memoizar la última caja menor: prioriza cajas activas, si no hay, trae la última por fecha
  const ultimaCajaMenor = useMemo(() => {
    if (cajaMenorRecords.length === 0) return null;
    
    // Primero buscar cajas activas
    const activas = cajaMenorRecords.filter(record => 
      record.estadoCajaMenor === 'Caja Menor Abierta' || !record.estadoCajaMenor
    );
    
    if (activas.length > 0) {
      // Si hay cajas activas, retornar la más reciente de las activas
      const activasOrdenadas = [...activas].sort((a, b) => 
        new Date(b.fechaAnticipo).getTime() - new Date(a.fechaAnticipo).getTime()
      );
      return activasOrdenadas[0];
    }
    
    // Si no hay activas, retornar la última por fecha (consolidada)
    const ordenados = [...cajaMenorRecords].sort((a, b) => 
      new Date(b.fechaAnticipo).getTime() - new Date(a.fechaAnticipo).getTime()
    );
    return ordenados[0];
  }, [cajaMenorRecords]);

  // Verificar si la última caja menor está consolidada
  const estaConsolidada = useMemo(() => {
    return ultimaCajaMenor?.estadoCajaMenor === 'Caja Menor Consiliada';
  }, [ultimaCajaMenor]);

  // Función para verificar la última caja menor
  const verificarUltimaCajaMenor = useCallback(() => {
    return ultimaCajaMenor;
  }, [ultimaCajaMenor]);

  // Actualizar el estado de caja menor actual cuando cambie
  useEffect(() => {
    setCajaMenorActual(ultimaCajaMenor || null);
  }, [ultimaCajaMenor]);

  // Memoizar el estado del botón de nueva caja menor
  const buttonState = useMemo(() => {
    const hayActivas = cajasMenoresActivas.length > 0;
    
    if (hayActivas) {
      return {
        className: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white/50 cursor-not-allowed',
        title: 'Debe consolidar las cajas menores activas antes de crear una nueva',
        text: 'Nueva Caja Menor',
        shortText: 'Caja',
        icon: 'DollarSign',
        disabled: true
      };
    }
    
    return {
      className: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-green-500/25',
      title: 'Crear nueva caja menor',
      text: 'Nueva Caja Menor',
      shortText: 'Caja',
      icon: 'DollarSign',
      disabled: false
    };
  }, [cajasMenoresActivas]);

  // Memoizar el handler del botón de nueva caja menor
  const handleNuevaCajaMenor = useCallback(() => {
    if (cajasMenoresActivas.length > 0) {
      alert('❌ No se puede crear una nueva caja menor\n\nDebe consolidar todas las cajas menores activas antes de crear una nueva.');
      return;
    }
    setShowCajaMenorModal(true);
  }, [cajasMenoresActivas]);

  // Actualizar el campo "Realiza Registro" cuando cambie el usuario
  useEffect(() => {
    setFormCajaMenor(prev => ({
      ...prev,
      realizaRegistro: userData?.nombre || 'Usuario'
    }));
  }, [userData]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando datos de Caja Menor...');
      
      const response = await fetch('/api/caja-menor', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error('Error al cargar los datos de caja menor');
      }

      const data = await response.json();
      console.log('✅ Datos recibidos:', data);

      if (data.success) {
        // Filtrar registros válidos antes de asignar al state
        const cajaMenorValidos = (data.cajaMenor || []).filter((record: any) => {
          const esValido = record && record.id && record.fechaAnticipo && record.beneficiario;
          if (!esValido) {
            console.warn('⚠️ Registro de Caja Menor inválido ignorado:', record);
          }
          return esValido;
        });

        const itemsValidos = (data.items || []).filter((item: any) => {
          const esValido = item && item.id && item.fecha && item.concepto;
          if (!esValido) {
            console.warn('⚠️ Item de Caja Menor inválido ignorado:', item);
          }
          return esValido;
        });

        setCajaMenorRecords(cajaMenorValidos);
        setItemsRecords(itemsValidos);
        
        const beneficiariosUnicos = itemsValidos.reduce((acc: Array<{ nombre: string; nitCC: string }>, item: any) => {
          const existe = acc.find(b => b.nombre === item.beneficiario);
          if (!existe && item.beneficiario) {
            acc.push({
              nombre: item.beneficiario,
              nitCC: item.nitCC || ''
            });
          }
          return acc;
        }, []);
        
        setBeneficiarios(beneficiariosUnicos);
        console.log(' Registros Caja Menor válidos:', cajaMenorValidos.length);
        console.log('📊 Items Caja Menor válidos:', itemsValidos.length);
        
        // Debug detallado de los primeros registros
        if (cajaMenorValidos.length > 0) {
          console.log('📋 Ejemplo Caja Menor válido:', {
            id: cajaMenorValidos[0]?.id,
            fecha: cajaMenorValidos[0]?.fechaAnticipo,
            beneficiario: cajaMenorValidos[0]?.beneficiario,
            concepto: cajaMenorValidos[0]?.concepto,
            valor: cajaMenorValidos[0]?.valor,
            tipo: typeof cajaMenorValidos[0]?.valor
          });
        }
        
        if (itemsValidos.length > 0) {
          console.log('📋 Ejemplo Item válido:', {
            id: itemsValidos[0]?.id,
            fecha: itemsValidos[0]?.fecha,
            concepto: itemsValidos[0]?.concepto,
            valor: itemsValidos[0]?.valor,
            tipo: typeof itemsValidos[0]?.valor
          });
        }

        // Debug de registros originales que fueron filtrados
        console.log('🔍 Total registros originales Caja Menor:', (data.cajaMenor || []).length);
        console.log('🔍 Total items originales:', (data.items || []).length);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      setError('Error al cargar los datos de caja menor');
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar datos predefinidos
  const cargarDatosPredefinidos = () => {
    const fechaActual = new Date();
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    const mesActual = meses[fechaActual.getMonth()];
    const añoActual = fechaActual.getFullYear();

    setFormCajaMenor({
      beneficiario: 'Joys Moreno',
      nitCC: '1026272126', // Cédula de Joys Moreno
      concepto: `CAJA MENOR ${mesActual} ${añoActual}`,
      valor: 2000000,
      realizaRegistro: userData?.nombre || 'Usuario'
    });
  };

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
        // Agregar la transcripción al campo de concepto
        setFormData(prev => ({
          ...prev,
          concepto: prev.concepto ? `${prev.concepto} ${result.transcription}` : result.transcription
        }));
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
  };

  // Función para obtener el nombre de la carpeta de la caja menor actual
  const obtenerNombreCarpetaCajaMenor = () => {
    if (!ultimaCajaMenor) return null;
    
    // Parsear fecha ISO sin problemas de zona horaria
    const [year, month] = ultimaCajaMenor.fechaAnticipo.split('T')[0].split('-');
    const fecha = new Date(parseInt(year), parseInt(month) - 1, 1);
    const mes = fecha.toLocaleDateString('es-CO', { month: 'long' }).toLowerCase();
    const anio = fecha.getFullYear();
    
    return `${mes}_${anio}_caja_menor`;
  };



  const generarPDFConsolidacion = async () => {
    if (!ultimaCajaMenor) return;
    
    setIsGeneratingPDF(true);
    try {
      // Filtrar items de la última caja menor
      const itemsDeLaCaja = itemsRecords.filter(item => 
        item.cajaMenor?.includes(ultimaCajaMenor.id)
      );

      // Preparar datos para el PDF
      const datosConsolidacion = {
        cajaMenor: {
          fechaAnticipo: ultimaCajaMenor.fechaAnticipo,
          fechaCierre: obtenerFechaLocal(),
          beneficiario: ultimaCajaMenor.beneficiario,
          nitCC: ultimaCajaMenor.nitCC || '',
          concepto: `CAJA MENOR ${formatearMesAnio(ultimaCajaMenor.fechaAnticipo)}`,
          valorInicial: ultimaCajaMenor.valor
        },
        items: itemsDeLaCaja.map((item, index) => ({
          item: index + 1,
          fecha: item.fecha,
          beneficiario: item.beneficiario,
          nitCC: item.nitCC || '',
          concepto: item.concepto,
          centroCosto: item.centroCosto || '',
          valor: item.valor
        })),
        totales: {
          totalLegalizado: totalEgresos,
          valorReintegrarSirius: totalIngresos - totalEgresos,
          valorReintegrarBeneficiario: 0
        }
      };

      console.log('📄 Generando PDF de consolidación...', datosConsolidacion);

      const response = await fetch('/api/generate-pdf-consolidacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosConsolidacion),
      });

      if (response.ok) {
        // El PDF viene directamente como blob
        const blob = await response.blob();
        
        // Extraer el nombre del archivo del header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        const fileName = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : 'consolidacion-caja-menor.pdf';
        
        // Crear URL temporal y descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ PDF descargado exitosamente:', fileName);
        alert(`✅ PDF descargado exitosamente\n\n📄 Archivo: ${fileName}`);
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Error al generar el PDF');
      }
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      alert('Error al generar el PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const confirmarConsolidacion = async () => {
    if (!ultimaCajaMenor) return;
    
    // Confirmar acción
    const confirmacion = confirm(
      '⚠️ CONFIRMAR CONSOLIDACIÓN\n\n' +
      '¿Está seguro de consolidar esta caja menor?\n\n' +
      'Esta acción:\n' +
      '✓ Generará y subirá el PDF de consolidación\n' +
      '✓ Registrará la fecha de consolidación\n' +
      '✓ Finalizará el periodo actual\n\n' +
      '⚠️ Esta acción NO se puede revertir'
    );

    if (!confirmacion) return;

    setIsConsolidating(true);
    try {
      // Filtrar items de la última caja menor
      const itemsDeLaCaja = itemsRecords.filter(item => 
        item.cajaMenor?.includes(ultimaCajaMenor.id)
      );

      // Preparar datos para el PDF
      const datosConsolidacion = {
        cajaMenor: {
          fechaAnticipo: ultimaCajaMenor.fechaAnticipo,
          fechaCierre: obtenerFechaLocal(),
          beneficiario: ultimaCajaMenor.beneficiario,
          nitCC: ultimaCajaMenor.nitCC || '',
          concepto: `CAJA MENOR ${formatearMesAnio(ultimaCajaMenor.fechaAnticipo)}`,
          valorInicial: ultimaCajaMenor.valor
        },
        items: itemsDeLaCaja.map((item, index) => ({
          item: index + 1,
          fecha: item.fecha,
          beneficiario: item.beneficiario,
          nitCC: item.nitCC || '',
          concepto: item.concepto,
          centroCosto: item.centroCosto || '',
          valor: item.valor,
          comprobanteUrl: item.comprobante?.[0]?.url || undefined
        })),
        totales: {
          totalLegalizado: totalEgresos,
          valorReintegrarSirius: totalIngresos - totalEgresos,
          valorReintegrarBeneficiario: 0
        }
      };

      console.log('📄 Generando PDF de consolidación para subir a S3...');

      // Generar PDF
      const pdfResponse = await fetch('/api/generate-pdf-consolidacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosConsolidacion),
      });

      if (!pdfResponse.ok) {
        throw new Error('Error al generar el PDF');
      }

      // Obtener el PDF como blob
      const pdfBlob = await pdfResponse.blob();
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfBuffer = Array.from(new Uint8Array(pdfArrayBuffer));

      console.log('✅ PDF generado, tamaño:', pdfBlob.size, 'bytes');

      // Obtener nombre de carpeta y fecha de consolidación
      const nombreCarpeta = obtenerNombreCarpetaCajaMenor();
      const fechaConsolidacion = obtenerFechaLocal();

      console.log('☁️ Subiendo PDF y actualizando registro...');

      // Consolidar: subir PDF a S3 y actualizar Airtable
      const consolidarResponse = await fetch('/api/consolidar-caja-menor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cajaMenorId: ultimaCajaMenor.id,
          pdfBuffer,
          nombreCarpeta,
          fechaConsolidacion
        }),
      });

      const consolidarResult = await consolidarResponse.json();

      if (!consolidarResponse.ok || !consolidarResult.success) {
        throw new Error(consolidarResult.error || 'Error al consolidar la caja menor');
      }

      console.log('✅ Consolidación completada exitosamente');

      // Agregar la URL del PDF a los datos de consolidación para el email
      const datosConsolidacionConPDF = {
        ...datosConsolidacion,
        pdfUrl: consolidarResult.pdfUrl,
        toEmails: ['adm@siriusregenerative.com', 'Contabilidad@siriusregenerative.com']
      };

      // Enviar email de notificación
      try {
        console.log('📧 Enviando email de notificación...');
        const emailResponse = await fetch('/api/send-email-consolidacion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(datosConsolidacionConPDF),
        });

        const emailResult = await emailResponse.json();
        
        if (emailResponse.ok && emailResult.success) {
          console.log('✅ Email enviado exitosamente');
        } else {
          console.warn('⚠️ Error enviando email:', emailResult.error);
          // No bloquear el flujo si falla el email
        }
      } catch (emailError) {
        console.error('❌ Error enviando email de notificación:', emailError);
        // No bloquear el flujo si falla el email
      }

      // Recargar datos
      await cargarDatos();
      
      // Cerrar modal
      setShowConsolidarModal(false);

      // Mostrar mensaje de éxito
      alert(
        '✅ CONSOLIDACIÓN EXITOSA\n\n' +
        '📄 PDF generado y almacenado\n' +
        '📅 Fecha de consolidación registrada\n' +
        '🔒 Periodo finalizado\n' +
        '📧 Notificación enviada por email\n\n' +
        'El periodo de caja menor ha sido cerrado exitosamente.\n' +
        'Puede crear una nueva caja menor para el próximo periodo.'
      );

    } catch (error) {
      console.error('❌ Error en consolidación:', error);
      alert('Error al consolidar la caja menor: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleSubmitCajaMenor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formCajaMenor.beneficiario || !formCajaMenor.concepto || formCajaMenor.valor <= 0) {
      alert('Por favor complete todos los campos');
      return;
    }

    try {
      setLoading(true);
      
      const nuevaCajaMenor = {
        fechaAnticipo: new Date().toISOString().split('T')[0],
        concepto: formCajaMenor.concepto,
        beneficiario: formCajaMenor.beneficiario,
        nitCC: formCajaMenor.nitCC,
        valor: formCajaMenor.valor,
        realizaRegistro: formCajaMenor.realizaRegistro
      };

      const response = await fetch('/api/caja-menor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'cajaMenor',
          data: nuevaCajaMenor
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear la caja menor');
      }

      if (result.success) {
        // Recargar datos
        await cargarDatos();
        setShowCajaMenorModal(false);
        setFormCajaMenor({ beneficiario: '', nitCC: '', concepto: '', valor: 0, realizaRegistro: userData?.nombre || 'Usuario' });
        alert('Caja menor creada exitosamente');
      } else {
        throw new Error(result.error || 'Error al crear la caja menor');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear la caja menor: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar que existe al menos una caja menor activa
    if (cajasMenoresActivas.length === 0) {
      alert('❌ No hay cajas menores activas para registrar items.\n\nPor favor, cree una caja menor primero.');
      setShowModal(false);
      setShowCajaMenorModal(true);
      return;
    }
    
    // Calcular saldo disponible actual (de la primera caja menor activa)
    const cajaActiva = cajasMenoresActivas[0];
    const totalIngresosCaja = cajaActiva?.valor || 0;
    const totalEgresosCaja = itemsRecords
      .filter(item => item.cajaMenor?.includes(cajaActiva?.id || ''))
      .reduce((sum, item) => sum + (item.valor || 0), 0);
    const saldoDisponible = totalIngresosCaja - totalEgresosCaja;
    
    // Validar que el valor del nuevo registro no supere el saldo disponible
    const valorNuevoRegistro = parseFloat(formData.valor) || 0;
    
    if (valorNuevoRegistro <= 0) {
      alert('❌ El valor debe ser mayor a cero.');
      return;
    }
    
    // Validar que el valor no sea excesivamente alto (máximo 1.000.000.000 - mil millones)
    if (valorNuevoRegistro > 1000000000) {
      alert('❌ El valor ingresado es excesivamente alto.\n\nValor máximo permitido: $1.000.000.000\nValor ingresado: $' + valorNuevoRegistro.toLocaleString('es-CO') + '\n\nPor favor, verifique el monto.');
      return;
    }
    
    if (saldoDisponible < 0) {
      alert('❌ La caja menor ya está en déficit. No se pueden registrar más gastos hasta consolidar la caja menor.');
      return;
    }
    
    if (valorNuevoRegistro > saldoDisponible) {
      alert(`❌ El valor del registro ($${valorNuevoRegistro.toLocaleString('es-CO')}) supera el saldo disponible de la caja menor.\n\n💰 Saldo disponible: $${saldoDisponible.toLocaleString('es-CO')}\n⚠️ Valor a registrar: $${valorNuevoRegistro.toLocaleString('es-CO')}\n🚫 Excedente: $${(valorNuevoRegistro - saldoDisponible).toLocaleString('es-CO')}\n\nPor favor, ingrese un valor menor o igual al saldo disponible.`);
      return;
    }
    
    try {
      setLoading(true);
      console.log('📝 Enviando item de caja menor:', formData);
      
      // Determinar el valor final del centro de costo
      const centroCostoFinal = formData.centroCosto === 'Otro' ? formData.centroCostoOtro : formData.centroCosto;
      
      let comprobanteUrl = '';
      
      // Subir archivo si existe
      if (formData.comprobanteFile) {
        console.log('📤 Subiendo comprobante...');
        
        // Generar carpeta basada en el mes y año actual
        const fechaActual = new Date();
        const mes = fechaActual.toLocaleString('es-CO', { month: 'long' }).toLowerCase();
        const año = fechaActual.getFullYear();
        const carpetaCajaMenor = `${mes}_${año}`;
        
        const formDataUpload = new FormData();
        formDataUpload.append('file', formData.comprobanteFile);
        formDataUpload.append('carpetaCajaMenor', carpetaCajaMenor);
        formDataUpload.append('beneficiario', formData.beneficiario);
        
        const uploadResponse = await fetch('/api/upload-comprobante-caja-menor', {
          method: 'POST',
          body: formDataUpload,
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || 'Error al subir el comprobante');
        }
        
        comprobanteUrl = uploadResult.fileUrl;
        console.log('✅ Comprobante subido:', comprobanteUrl);
      }
      
      // Crear el item y vincularlo automáticamente a la primera caja menor activa
      const nuevoItem = {
        fecha: formData.fecha,
        beneficiario: formData.beneficiario,
        nitCC: formData.nitCC,
        concepto: formData.concepto,
        centroCosto: centroCostoFinal,
        valor: parseFloat(formData.valor) || 0,
        realizaRegistro: formData.realizaRegistro,
        cajaMenorId: cajaActiva?.id || '', // Vincular con la primera caja menor activa
        comprobanteUrl: comprobanteUrl || undefined
      };

      const response = await fetch('/api/caja-menor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'item',
          data: nuevoItem
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear el item');
      }

      console.log('✅ Item creado exitosamente:', result);

      // Recargar datos
      await cargarDatos();
      setShowModal(false);
      resetForm();
      alert('✅ Item registrado exitosamente y vinculado a la caja menor del mes.');
      
    } catch (error) {
      console.error('❌ Error al enviar:', error);
      alert('Error al guardar el item: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      beneficiario: '',
      nitCC: '',
      concepto: '',
      centroCosto: '',
      centroCostoOtro: '',
      valor: '',
      realizaRegistro: userData?.nombre || 'Usuario',
      comprobanteFile: null
    });
    setEditingItem(null);
    setEsNuevoBeneficiario(false);
    setAudioBlob(null);
  };

  // Evitar procesamiento durante la carga
  if (loading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="text-white text-lg font-semibold">Cargando datos de Caja Menor...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-2xl max-w-md mx-4">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <div className="text-red-400 text-xl font-bold mb-4">❌ Error</div>
              <p className="text-red-300 mb-6">{error}</p>
              <button
                onClick={cargarDatos}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold shadow-lg"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Combinar datos para mostrar en la tabla
  type ItemUnificado = {
    id: string;
    fecha: string;
    concepto: string;
    valor: number;
    beneficiario: string;
    tipo: 'anticipo' | 'gasto';
    estado: string;
    categoria: string;
    responsable: string;
    comprobante?: string;
    cajaMenorId?: string[]; // Para filtrar items de la caja menor
  };

  const todosLosItems: ItemUnificado[] = [
    // Filtrar y mapear registros de Caja Menor (solo los que tienen datos válidos)
    ...cajaMenorRecords
      .filter(record => 
        record && 
        record.id && 
        record.fechaAnticipo && 
        record.concepto && 
        record.beneficiario &&
        record.valor !== null &&
        record.valor !== undefined
      )
      .map(record => ({
        id: record.id,
        fecha: record.fechaAnticipo,
        concepto: record.concepto,
        valor: Number(record.valor) || 0,
        beneficiario: record.beneficiario,
        tipo: 'anticipo' as const,
        estado: 'aprobado',
        categoria: 'Anticipo',
        responsable: record.realizaRegistro || record.beneficiario || 'Sistema',
        comprobante: undefined
      })),
    // Filtrar y mapear registros de Items (solo los que tienen datos válidos)
    ...itemsRecords
      .filter(item => 
        item && 
        item.id && 
        item.fecha && 
        item.concepto && 
        item.beneficiario &&
        item.valor !== null &&
        item.valor !== undefined
      )
      .map(item => ({
        id: item.id,
        fecha: item.fecha,
        concepto: item.concepto,
        valor: Number(item.valor) || 0,
        beneficiario: item.beneficiario,
        tipo: 'gasto' as const,
        estado: 'aprobado',
        categoria: 'Gasto',
        responsable: item.beneficiario || 'Sistema',
        comprobante: undefined,
        cajaMenorId: item.cajaMenor
      }))
  ];

  const itemsFiltrados = todosLosItems.filter(item => {
    // Validar que el item existe y tiene las propiedades necesarias
    if (!item || typeof item !== 'object') return false;
    
    // Si no hay última caja menor, no mostrar ningún registro
    if (!ultimaCajaMenor) return false;
    
    // Solo mostrar registros de cajas menores activas
    if (item.tipo === 'anticipo' && !cajasMenoresActivas.some(caja => caja.id === item.id)) return false;
    if (item.tipo === 'gasto' && !item.cajaMenorId?.some(id => cajasMenoresActivas.some(caja => caja.id === id))) return false;
    
    const searchText = busqueda.toLowerCase();
    const matchBusqueda = (item.concepto || '').toLowerCase().includes(searchText) ||
                         (item.beneficiario || '').toLowerCase().includes(searchText) ||
                         (item.categoria || '').toLowerCase().includes(searchText);
    
    const matchTipo = filtroTipo === 'todos' || 
                     (filtroTipo === 'ingreso' && item.tipo === 'anticipo') ||
                     (filtroTipo === 'egreso' && item.tipo === 'gasto');
    
    const matchEstado = filtroEstado === 'todos' || item.estado === filtroEstado;
    
    return matchBusqueda && matchTipo && matchEstado;
  });

  // Calcular totales de todas las cajas menores activas
  const totalIngresos = cajasMenoresActivas.reduce((sum, caja) => sum + (caja.valor || 0), 0);
  
  // Calcular egresos de todas las cajas menores activas
  const totalEgresos = itemsRecords
    .filter(item => {
      // Items que pertenecen a cajas menores activas
      return cajasMenoresActivas.some(caja => item.cajaMenor?.includes(caja.id));
    })
    .reduce((sum, item) => sum + (item.valor || 0), 0);

  const saldoActual = totalIngresos - totalEgresos;

  // Debug: Log de estado actual
  console.log('📊 Estado Dashboard Caja Menor:', {
    ultimaCajaMenor: !!ultimaCajaMenor,
    estaConsolidada,
    totalIngresos,
    totalEgresos,
    saldoActual,
    itemsFiltrados: itemsFiltrados.length
  });

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/18032025-DSC_2933.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>
      <div className="relative z-10 pt-24">
        <div className="max-w-full mx-auto px-6 py-8">
          
          {/* Header Profesional */}
          <div className="mb-8">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-2xl px-8 py-6 border border-white/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                    <DollarSign className="w-10 h-10 text-green-400" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold text-white">
                      Caja Menor
                    </h1>
                    <p className="text-white/90 mt-1 text-lg">
                      Gestión integral de fondos menores - Control mensual con trazabilidad completa
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-full border border-green-500/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-300 font-semibold text-sm">Sistema Activo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas de resumen - Diseño Profesional */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {/* Tarjeta 1: Disponible Caja Menor */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                  <DollarSign className="w-7 h-7 text-green-400" />
                </div>
                {ultimaCajaMenor && (
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full border border-green-500/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-green-300">Activa</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">
                  {cajasMenoresActivas.length > 0 ? 'Total Cajas Menores Activas' : 'Sin Cajas Menores'}
                </p>
                <p className="text-3xl font-bold text-green-400 mb-2">
                  ${totalIngresos.toLocaleString('es-CO')}
                </p>
                {cajasMenoresActivas.length > 0 ? (
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {cajasMenoresActivas.length} caja{cajasMenoresActivas.length > 1 ? 's' : ''} activa{cajasMenoresActivas.length > 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No registrada
                  </p>
                )}
              </div>
            </div>

            {/* Tarjeta 2: Total Egresos */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30">
                  <DollarSign className="w-7 h-7 text-red-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">Total Egresos</p>
                <p className="text-3xl font-bold text-red-400 mb-2">
                  ${totalEgresos.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-white/60 flex items-center gap-1">
                  <Receipt className="w-3 h-3" />
                  Gastos registrados
                </p>
              </div>
            </div>

            {/* Tarjeta 3: Saldo Actual */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 ${saldoActual >= 0 ? 'bg-blue-500/20 border-blue-500/30' : 'bg-orange-500/20 border-orange-500/30'} rounded-xl border`}>
                  <DollarSign className={`w-7 h-7 ${saldoActual >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
                </div>
                {saldoActual < 0 && (
                  <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full border border-orange-500/30">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-orange-300">Déficit</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">Saldo Actual</p>
                <p className={`text-3xl font-bold mb-2 ${saldoActual >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                  ${Math.abs(saldoActual).toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-white/60">
                  {saldoActual >= 0 ? '✅ Disponible' : '⚠️ En déficit'}
                </p>
              </div>
            </div>

            {/* Tarjeta 4: Total Registros */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <Receipt className="w-7 h-7 text-purple-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">Total Registros</p>
                <p className="text-3xl font-bold text-purple-400 mb-2">
                  {itemsFiltrados.length}
                </p>
                <p className="text-xs text-white/60 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Movimientos activos
                </p>
              </div>
            </div>

            {/* Tarjeta 5: Porcentaje Consumido */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border ${
                  totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70
                    ? 'bg-orange-500/20 border-orange-500/30'
                    : 'bg-cyan-500/20 border-cyan-500/30'
                }`}>
                  <FileText className={`w-7 h-7 ${
                    totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70
                      ? 'text-orange-400'
                      : 'text-cyan-400'
                  }`} />
                </div>
                {totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70 && (
                  <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full border border-orange-500/30">
                    <AlertTriangle className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-bold text-orange-300">Alto</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">Consumo Actual</p>
                <p className={`text-3xl font-bold mb-2 ${
                  totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70
                    ? 'text-orange-400'
                    : 'text-cyan-400'
                }`}>
                  {totalIngresos > 0 ? ((totalEgresos / totalIngresos) * 100).toFixed(1) : '0'}%
                </p>
                <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${totalIngresos > 0 ? Math.min((totalEgresos / totalIngresos) * 100, 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-white/60">
                  {totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70 
                    ? '⚠️ Requiere consolidación' 
                    : '✓ Nivel normal'}
                </p>
              </div>
            </div>
          </div>

          {/* Alerta: Caja Menor Consolidada */}
          {ultimaCajaMenor && estaConsolidada && (
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-green-500/50 mb-8 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30 flex-shrink-0">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-300 mb-1">
                    ✅ Caja Menor Consolidada - {formatearMesAnio(ultimaCajaMenor.fechaAnticipo)}
                  </h3>
                  <p className="text-sm text-white/80">
                    Esta caja menor fue consolidada el {formatearFecha(ultimaCajaMenor.fechaConsolidacion || '')}. 
                    No se pueden agregar más gastos. Puede crear una nueva caja menor para el próximo periodo.
                  </p>
                </div>
                <button
                  onClick={() => setShowCajaMenorModal(true)}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold shadow-lg whitespace-nowrap"
                >
                  Nueva Caja Menor
                </button>
              </div>
            </div>
          )}

          {/* Alerta: No hay caja menor del mes actual */}
          {!ultimaCajaMenor && (
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-yellow-500/50 mb-8 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30 flex-shrink-0">
                  <AlertTriangle className="w-7 h-7 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-yellow-300 mb-1">
                    No hay Caja Menor registrada
                  </h3>
                  <p className="text-sm text-white/80">
                    Para registrar gastos, primero debe crear una caja menor especificando quién estará a cargo y el monto disponible.
                  </p>
                </div>
                <button
                  onClick={() => setShowCajaMenorModal(true)}
                  className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-semibold shadow-lg whitespace-nowrap"
                >
                  Registrar Caja Menor
                </button>
              </div>
            </div>
          )}

          {/* Alerta: Valores anormalmente altos detectados */}
          {ultimaCajaMenor && itemsRecords.some(item => {
            return item.cajaMenor?.includes(ultimaCajaMenor.id) && item.valor > 100000000;
          }) && (
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-red-500/50 mb-8 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 flex-shrink-0">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-300 mb-1">
                    ⚠️ Datos Anormales Detectados
                  </h3>
                  <p className="text-sm text-white/80">
                    Se han detectado registros con valores excesivamente altos que pueden ser erróneos. Esto está afectando los cálculos del saldo y consumo. Por favor, revise los gastos registrados y contacte al administrador para corregir los datos.
                  </p>
                  <p className="text-xs text-red-300/80 mt-2">
                    💡 Los registros con valores superiores a $100.000.000 pueden indicar errores de digitación.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Controles - Diseño Profesional */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl mb-8">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                {/* Búsqueda */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por concepto, beneficiario..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                  />
                </div>

                {/* Filtros */}
                <div className="flex gap-3">
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 min-w-[140px]"
                  >
                    <option value="todos">Todos los tipos</option>
                    <option value="ingreso">Ingresos</option>
                    <option value="egreso">Egresos</option>
                  </select>

                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 min-w-[140px]"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
              </div>

              {/* Botones de acción - Solo visibles si hay cajas menores activas */}
              {cajasMenoresActivas.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <button
                    onClick={() => {
                      if (totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 100) {
                        alert('❌ Cajas menores al 100% de consumo\n\nNo se pueden registrar más gastos.');
                      } else {
                        setShowModal(true);
                      }
                    }}
                    disabled={totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 100}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-blue-500/25 disabled:hover:shadow-none"
                    title={
                      totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 100
                        ? 'Cajas menores al 100% de consumo - No se pueden registrar más gastos'
                        : 'Registrar nuevo gasto'
                    }
                  >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Gasto</span>
                  </button>
                  
                  {/* Botón Consolidar Caja Menor - Solo visible si consumo >= 70% */}
                  {totalIngresos > 0 && (totalEgresos / totalIngresos) * 100 >= 70 && (
                    <button
                      onClick={() => setShowConsolidarModal(true)}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-orange-500/25 animate-pulse"
                      title="Consolidar caja menor - Consumo mayor al 70%"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      <span>Consolidar Caja Menor</span>
                    </button>
                  )}
                </div>
              )}
              
              {/* Botón Nueva Caja Menor - Solo visible si NO hay cajas activas */}
              {cajasMenoresActivas.length === 0 && (
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <button
                    onClick={handleNuevaCajaMenor}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg ${buttonState.className}`}
                    title={buttonState.title}
                  >
                    {buttonState.icon === 'CheckCircle' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <DollarSign className="w-5 h-5" />
                    )}
                    <span>{buttonState.text}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabla - Diseño Profesional */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/30 overflow-hidden shadow-xl mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center p-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                  <span className="ml-4 text-white font-semibold">Cargando datos...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <AlertCircle className="w-16 h-16 text-red-400 mb-6" />
                  <p className="text-red-400 font-bold mb-3 text-lg">Error al cargar datos</p>
                  <p className="text-white/70 mb-6 max-w-md">{error}</p>
                  <button
                    onClick={cargarDatos}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg"
                  >
                    Reintentar
                  </button>
                </div>
              ) : itemsFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <Receipt className="w-16 h-16 text-white/40 mb-6" />
                  <p className="text-white/70 text-lg font-semibold">No se encontraron registros</p>
                  <p className="text-white/50 text-sm mt-2">Intenta ajustar los filtros o crear un nuevo registro</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20 bg-slate-700/60">
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Concepto
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Categoría
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                        Responsable
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {itemsFiltrados.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-700/40 transition-all duration-200 group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                            <span className="text-sm text-white font-medium">
                              {formatearFecha(item.fecha)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-white font-medium truncate max-w-xs">
                            {item.concepto || 'Sin concepto'}
                          </div>
                          {item.comprobante && (
                            <div className="text-xs text-white/60 mt-1">
                              {item.comprobante}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-bold ${
                            item.tipo === 'anticipo' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {item.tipo === 'anticipo' ? '+' : '-'}${(Number(item.valor) || 0).toLocaleString('es-CO')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            item.tipo === 'anticipo' 
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {item.tipo === 'anticipo' ? '💰 Caja Menor' : '🛒 Gasto'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-white/90 font-medium">{item.categoria}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                            <span className="text-sm text-white font-medium">{item.responsable}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {(() => {
                            const comprobante = (item as any).comprobante;
                            if (comprobante && Array.isArray(comprobante) && comprobante.length > 0) {
                              const archivo = comprobante[0];
                              return (
                                <a
                                  href={archivo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold border border-blue-500/30 transition-all duration-200"
                                  title={`Descargar ${archivo.filename || 'comprobante'}`}
                                >
                                  {archivo.type?.includes('pdf') ? '📄' : '🖼️'}
                                  <span>Ver</span>
                                </a>
                              );
                            }
                            return (
                              <span className="text-white/40 text-xs italic">Sin comprobante</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold border ${
                            item.estado === 'aprobado' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            item.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                            'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {item.estado === 'aprobado' ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprobado
                              </>
                            ) : item.estado === 'pendiente' ? (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Rechazado
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        {/* Modal de nueva caja menor - Diseño Profesional */}
        {showCajaMenorModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/30 shadow-2xl mt-16">
              <div className="sticky top-0 bg-slate-800/98 backdrop-blur-md px-6 py-4 border-b border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-xl border border-green-500/30">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Nueva Caja Menor
                  </h3>
                </div>
                <button
                  onClick={() => setShowCajaMenorModal(false)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors border border-white/20"
                >
                  <span className="w-5 h-5 text-white/80">✕</span>
                </button>
              </div>

              {/* Advertencia Importante */}
              <div className="mx-6 mt-4 p-4 bg-amber-600/20 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-amber-400 font-bold text-sm mb-1">
                      ⚠️ IMPORTANTE - Control de Cajas Menores
                    </h4>
                    <p className="text-amber-200/90 text-xs leading-relaxed">
                      • Una vez registrada la caja menor, <strong>NO se puede modificar</strong><br/>
                      • Debe consolidar las cajas activas antes de crear una nueva<br/>
                      • Asegúrate de que todos los datos sean correctos antes de guardar
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón cargar predefinido */}
              <div className="px-6 pt-4 pb-2">
                <button
                  type="button"
                  onClick={cargarDatosPredefinidos}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-semibold border border-purple-500"
                >
                  <User className="w-4 h-4" />
                  Cargar Datos Predefinidos (Joys Moreno - $2.000.000)
                </button>
                <p className="text-xs text-white/50 mt-1 text-center">
                  Completa automáticamente los campos con valores estándar
                </p>
              </div>

              <form onSubmit={handleSubmitCajaMenor} className="p-6 pt-3 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Responsable de la Caja Menor *
                  </label>
                  <input
                    type="text"
                    value={formCajaMenor.beneficiario}
                    onChange={(e) => setFormCajaMenor({...formCajaMenor, beneficiario: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-700/30 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                    placeholder="Nombre del responsable"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    NIT-CC
                  </label>
                  <input
                    type="text"
                    value={formCajaMenor.nitCC}
                    onChange={(e) => setFormCajaMenor({...formCajaMenor, nitCC: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-700/30 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                    placeholder="Número de identificación"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Registrado por
                  </label>
                  <div className="w-full px-4 py-2.5 bg-slate-700/50 border border-white/10 rounded-lg text-white/80 text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    {formCajaMenor.realizaRegistro}
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    Este campo se completa automáticamente con tu usuario
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Concepto *
                  </label>
                  <input
                    type="text"
                    value={formCajaMenor.concepto}
                    onChange={(e) => setFormCajaMenor({...formCajaMenor, concepto: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-700/30 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                    placeholder="Ej: Caja menor mes de noviembre 2024"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Valor Disponible *
                  </label>
                  <input
                    type="text"
                    value={formCajaMenor.valor ? formCajaMenor.valor.toLocaleString('es-CO') : ''}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '');
                      setFormCajaMenor({...formCajaMenor, valor: parseInt(valor) || 0});
                    }}
                    className="w-full px-4 py-2.5 bg-slate-700/30 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                    placeholder="Monto disponible para gastos"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors font-semibold shadow-lg"
                  >
                    {loading ? 'Creando...' : 'Crear Caja Menor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCajaMenorModal(false)}
                    className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de nuevo/editar registro - Diseño Profesional */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] mt-16">
            <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-white/30 shadow-2xl">
              <div className="sticky top-0 bg-slate-800/98 backdrop-blur-md px-8 py-6 border-b border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <Plus className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {editingItem ? 'Editar Registro' : 'Nuevo Registro de Caja Menor'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="p-3 hover:bg-slate-700/50 rounded-xl transition-all duration-200 border border-white/20 hover:border-white/40"
                >
                  <span className="w-5 h-5 text-white/80">✕</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-400" />
                      Valor *
                    </label>
                    <input
                      type="text"
                      value={formData.valor ? parseInt(formData.valor).toLocaleString('es-CO') : ''}
                      onChange={(e) => {
                        const valor = e.target.value.replace(/\D/g, '');
                        setFormData(prev => ({ ...prev, valor: valor }));
                      }}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                      required
                    />
                    {ultimaCajaMenor && formData.valor && (() => {
                      const valorIngresado = parseFloat(formData.valor) || 0;
                      const totalIngresosCaja = ultimaCajaMenor.valor || 0;
                      const totalEgresosCaja = itemsRecords
                        .filter(item => item.cajaMenor?.includes(ultimaCajaMenor.id))
                        .reduce((sum, item) => sum + (item.valor || 0), 0);
                      const saldoDisponible = totalIngresosCaja - totalEgresosCaja;
                      const excedente = valorIngresado - saldoDisponible;
                      
                      if (valorIngresado > saldoDisponible) {
                        return (
                          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-red-300">
                                <p className="font-bold">⚠️ Valor supera el saldo disponible</p>
                                <p className="mt-1">Saldo disponible: <strong>${saldoDisponible.toLocaleString('es-CO')}</strong></p>
                                <p>Excedente: <strong>${excedente.toLocaleString('es-CO')}</strong></p>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (valorIngresado > saldoDisponible * 0.7) {
                        return (
                          <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-yellow-300">
                                <p className="font-bold">⚠️ Alto consumo del saldo</p>
                                <p className="mt-1">Saldo restante: <strong>${(saldoDisponible - valorIngresado).toLocaleString('es-CO')}</strong></p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      Beneficiario *
                    </label>
                    <select
                      value={esNuevoBeneficiario ? 'nuevo' : formData.beneficiario}
                      onChange={(e) => {
                        if (e.target.value === 'nuevo') {
                          setEsNuevoBeneficiario(true);
                          setFormData(prev => ({ ...prev, beneficiario: '', nitCC: '' }));
                        } else {
                          setEsNuevoBeneficiario(false);
                          const beneficiarioSeleccionado = beneficiarios.find(b => b.nombre === e.target.value);
                          if (beneficiarioSeleccionado) {
                            setFormData(prev => ({ 
                              ...prev, 
                              beneficiario: beneficiarioSeleccionado.nombre,
                              nitCC: beneficiarioSeleccionado.nitCC 
                            }));
                          }
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 appearance-none cursor-pointer hover:bg-slate-700/80"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.75rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5rem 1.5rem',
                        paddingRight: '2.5rem'
                      }}
                      required={!esNuevoBeneficiario}
                    >
                      <option value="" className="bg-slate-800 text-white/70">Seleccionar beneficiario</option>
                      {beneficiarios.map((beneficiario, index) => (
                        <option key={index} value={beneficiario.nombre} className="bg-slate-800 text-white">
                          👤 {beneficiario.nombre}
                        </option>
                      ))}
                      <option value="nuevo" className="bg-slate-800 text-white">➕ Nuevo Beneficiario</option>
                    </select>
                    
                    {esNuevoBeneficiario && (
                      <div className="mt-3 animate-fadeIn">
                        <input
                          type="text"
                          value={formData.beneficiario}
                          onChange={(e) => setFormData(prev => ({ ...prev, beneficiario: e.target.value }))}
                          placeholder="✏️ Nombre del nuevo beneficiario"
                          className="w-full px-4 py-3 bg-slate-700/60 border border-blue-400/40 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-blue-400" />
                      NIT / CC {esNuevoBeneficiario && '*'}
                    </label>
                    {esNuevoBeneficiario ? (
                      <input
                        type="text"
                        value={formData.nitCC}
                        onChange={(e) => setFormData(prev => ({ ...prev, nitCC: e.target.value }))}
                        placeholder="✏️ Número de identificación"
                        className="w-full px-4 py-3 bg-slate-700/60 border border-blue-400/40 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                        required
                      />
                    ) : (
                      <div className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white/80 text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-blue-400" />
                        {formData.nitCC || 'No especificado'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Concepto *
                  </label>
                  
                  <div className="relative">
                    <textarea
                      value={formData.concepto}
                      onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                      placeholder="Descripción del gasto o use el botón de grabación para dictar..."
                      rows={4}
                      className="w-full px-4 py-3 pr-32 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 resize-none"
                      required
                    />
                    
                    {/* Botones de grabación dentro del textarea */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-semibold shadow-lg"
                          title="Grabar audio"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          Grabar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-semibold shadow-lg animate-pulse"
                          title="Detener grabación"
                        >
                          <MicOff className="w-3.5 h-3.5" />
                          Detener
                        </button>
                      )}
                    </div>
                    
                    {/* Indicador de transcripción */}
                    {isTranscribing && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-yellow-600/90 border border-yellow-500/50 rounded-lg text-yellow-100 text-xs font-medium shadow-lg">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-100"></div>
                        Transcribiendo...
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-400" />
                    Centro de Costo
                  </label>
                  <div className="relative">
                    <select
                      value={formData.centroCosto}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, centroCosto: e.target.value, centroCostoOtro: '' }));
                      }}
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 appearance-none cursor-pointer hover:bg-slate-700/80"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.75rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5rem 1.5rem',
                        paddingRight: '2.5rem'
                      }}
                    >
                      <option value="" className="bg-slate-800 text-white/70">Seleccionar departamento o área</option>
                      <option value="Pirólisis" className="bg-slate-800 text-white">🔥 Pirólisis</option>
                      <option value="Administrativo" className="bg-slate-800 text-white">📋 Administrativo</option>
                      <option value="Laboratorio" className="bg-slate-800 text-white">🧪 Laboratorio</option>
                      <option value="Otro" className="bg-slate-800 text-white">➕ Otro</option>
                    </select>
                  </div>
                  
                  {formData.centroCosto === 'Otro' && (
                    <div className="mt-3 animate-fadeIn">
                      <input
                        type="text"
                        value={formData.centroCostoOtro}
                        onChange={(e) => setFormData(prev => ({ ...prev, centroCostoOtro: e.target.value }))}
                        placeholder="✏️ Especificar otro centro de costo"
                        className="w-full px-4 py-3 bg-slate-700/60 border border-blue-400/40 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Documento soporte (Opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setFormData(prev => ({ ...prev, comprobanteFile: file }));
                      }}
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    <p className="text-xs text-white/50 mt-2">
                      Formatos permitidos: PDF, JPG, PNG. Tamaño máximo: 10MB
                    </p>
                    {formData.comprobanteFile && (
                      <p className="text-xs text-green-400 mt-1">
                        📄 Archivo seleccionado: {formData.comprobanteFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    Registrado por
                  </label>
                  <div className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-xl text-white/80 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    {formData.realizaRegistro}
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    Este campo se completa automáticamente con tu usuario
                  </p>
                </div>

                {ultimaCajaMenor && (
                  <div className="p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-blue-400 font-bold text-sm mb-1">
                          ✅ Se vinculará a la última Caja Menor activa
                        </h4>
                        <p className="text-blue-200/90 text-xs leading-relaxed">
                          Responsable: <strong>{ultimaCajaMenor.beneficiario}</strong><br/>
                          Valor disponible: <strong>${ultimaCajaMenor.valor?.toLocaleString('es-CO')}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading || ((): boolean => {
                      if (!ultimaCajaMenor || !formData.valor) return false;
                      const valorIngresado = parseFloat(formData.valor) || 0;
                      const totalIngresosCaja = ultimaCajaMenor.valor || 0;
                      const totalEgresosCaja = itemsRecords
                        .filter(item => item.cajaMenor?.includes(ultimaCajaMenor.id))
                        .reduce((sum, item) => sum + (item.valor || 0), 0);
                      const saldoDisponible = totalIngresosCaja - totalEgresosCaja;
                      return valorIngresado > saldoDisponible;
                    })()}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {loading ? 'Guardando...' : 'Guardar Item'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

          {/* Resumen de estado de la caja menor */}
          {cajaMenorActual && (
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Resumen de Caja Menor Actual
                  </h3>
                  <p className="text-sm text-white/70">Última caja registrada: {formatearFecha(cajaMenorActual.fechaAnticipo)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">Responsable</p>
                  <p className="text-white font-bold text-lg">{cajaMenorActual.beneficiario}</p>
                </div>
                
                <div className="bg-slate-700/30 rounded-lg p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">Registrado por</p>
                  <p className="text-blue-300 font-bold text-lg">{cajaMenorActual.realizaRegistro || 'No especificado'}</p>
                </div>
                
                <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/30">
                  <p className="text-xs text-green-300/80 mb-1">Monto Inicial</p>
                  <p className="text-green-400 font-bold text-lg">
                    ${cajaMenorActual.valor?.toLocaleString('es-CO')}
                  </p>
                </div>
                
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                  <p className="text-xs text-red-300/80 mb-1">Total Gastado</p>
                  <p className="text-red-400 font-bold text-lg">
                    ${totalEgresos.toLocaleString('es-CO')}
                  </p>
                </div>
                
                <div className={`${saldoActual >= 0 ? 'bg-blue-900/20 border-blue-500/30' : 'bg-orange-900/20 border-orange-500/30'} rounded-lg p-4 border`}>
                  <p className={`text-xs ${saldoActual >= 0 ? 'text-blue-300/80' : 'text-orange-300/80'} mb-1`}>Saldo Disponible</p>
                  <p className={`${saldoActual >= 0 ? 'text-blue-400' : 'text-orange-400'} font-bold text-xl`}>
                    ${saldoActual.toLocaleString('es-CO')}
                    {saldoActual < 0 && <span className="text-xs ml-1">(Déficit)</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Vista Previa de Consolidación */}
      {showConsolidarModal && ultimaCajaMenor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 px-8 py-6 rounded-t-3xl border-b border-white/20 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white">Vista Previa de Consolidación</h2>
                    <p className="text-orange-100 mt-1">Formato de Legalización de Anticipo General</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConsolidarModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <span className="text-white text-2xl">×</span>
                </button>
              </div>
            </div>

            {/* Contenido del Modal - Vista Previa del Formato */}
            <div className="p-8">
              {/* Encabezado del Formato */}
              <div className="bg-white rounded-xl p-6 mb-6 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-xl">SR</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">SIRIUS</h3>
                      <p className="text-gray-600 text-sm">Regenerative Solutions SAS ZOMAC</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Fecha de Actualización:</p>
                    <p className="font-bold text-gray-800">{new Date().toLocaleDateString('es-CO')}</p>
                  </div>
                </div>
                <div className="border-t-2 border-blue-600 pt-4">
                  <h4 className="text-xl font-bold text-center text-gray-800">
                    FORMATO DE LEGALIZACIÓN DE ANTICIPO GENERAL
                  </h4>
                </div>
              </div>

              {/* Información del Centro de Costos */}
              <div className="bg-blue-50 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">FECHA</p>
                    <div className="text-gray-800 font-medium">
                      <p className="text-sm">
                        <span className="font-semibold">Fecha del anticipo:</span>{' '}
                        {formatearFecha(ultimaCajaMenor.fechaAnticipo)}
                      </p>
                      <p className="text-sm mt-1">
                        <span className="font-semibold">Fecha fin:</span>{' '}
                        {new Date().toLocaleDateString('es-CO')}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">BENEFICIARIO</p>
                    <p className="text-gray-800 font-medium">{ultimaCajaMenor.beneficiario}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">NIT/CC</p>
                    <p className="text-gray-800 font-medium">{ultimaCajaMenor.nitCC || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">CONCEPTO</p>
                    <p className="text-gray-800 font-medium">
                      CAJA MENOR {formatearMesAnio(ultimaCajaMenor.fechaAnticipo)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-gray-600 mb-1">VALOR CAJA MENOR</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${ultimaCajaMenor.valor.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabla de Items */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">ITEM</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">FECHA</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">BENEFICIARIO</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">NIT</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">CONCEPTO</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">C.C</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">DOCUMENTO SOPORTE</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">VALOR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {itemsRecords
                        .filter(item => item.cajaMenor?.includes(ultimaCajaMenor.id))
                        .map((item, index) => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatearFecha(item.fecha)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.beneficiario}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.nitCC || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                              {item.concepto}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">
                              {item.centroCosto || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {(() => {
                                const comprobante = (item as any).comprobante;
                                if (comprobante && Array.isArray(comprobante) && comprobante.length > 0) {
                                  const archivo = comprobante[0];
                                  return (
                                    <a
                                      href={archivo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-semibold transition-colors"
                                      title={`Ver ${archivo.filename || 'comprobante'}`}
                                    >
                                      {archivo.type?.includes('pdf') ? '📄' : '🖼️'}
                                      Ver
                                    </a>
                                  );
                                }
                                return <span className="text-gray-400 text-xs">-</span>;
                              })()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                              ${item.valor.toLocaleString('es-CO')}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm font-semibold text-gray-600 mb-1">TOTAL LEGALIZADO</p>
                    <p className="text-2xl font-bold text-blue-600">${totalEgresos.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm font-semibold text-gray-600 mb-1">VALOR A REINTEGRAR A SIRIUS</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${(totalIngresos - totalEgresos).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm font-semibold text-gray-600 mb-1">VALOR A REINTEGRAR AL BENEFICIARIO</p>
                    <p className="text-2xl font-bold text-orange-600">$0</p>
                  </div>
                </div>
              </div>

              {/* Nota Legal */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Nota:</strong> Adjunto a esta legalización se relacionan los soportes físicos legales y originales que 
                  soportan los gastos efectuados. Todos los soportes los encuentro ordenados de la misma manera en 
                  que aparecen en la legalización. Aclaro que por medio de los siguientes firmas certificamos que los 
                  gastos relacionados corresponden a gastos efectuados para el normal funcionamiento de las actividades 
                  de Sirius Regenerative Solutions SAS ZOMAC, que se encuentran en el subdominio autorizado dentro del 
                  mes, no se debe legalizar separadamente a fin de quedar sin gastos registrados dentro del mes en el 
                  que se hizo el gasto. No has recibido culpa alguna de las actividades dentro del mes.
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-4">
                <button
                  onClick={generarPDFConsolidacion}
                  disabled={isGeneratingPDF}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Descargar PDF
                    </>
                  )}
                </button>
                <button
                  onClick={confirmarConsolidacion}
                  disabled={isConsolidating}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-green-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConsolidating ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      Consolidando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirmar Consolidación
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConsolidarModal(false)}
                  className="px-6 py-4 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CajaMenor() {
  const { isAuthenticated, userData, isLoading, login, logout } = useAuthSession();

  const handleValidationSuccess = (user: UserData) => {
    login(user);
  };

  const handleValidationError = (error: string) => {
    console.error('Error de validación:', error);
  };

  const handleLogout = () => {
    logout();
  };

  // Mostrar spinner mientras se verifica la sesión existente
  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="text-white text-lg font-semibold">Verificando sesión...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167074/20032025-DSC_3427_1_1_zmq71m.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/50"></div>
        <div className="relative z-10">
          <ValidacionUsuario
            onValidationSuccess={handleValidationSuccess}
            onValidationError={handleValidationError}
          />
        </div>
      </div>
    );
  }

  // Verificar que userData no sea null
  if (!userData) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-2xl">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-semibold">Cargando datos del usuario...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CajaMenorDashboard
      userData={userData}
      onLogout={handleLogout}
    />
  );
}
