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
  FileText
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
    valor: '',
    realizaRegistro: userData?.nombre || 'Usuario'
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

  // Función para obtener el mes y año actual
  const obtenerMesActual = () => {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  };

  // Memoizar la caja menor del mes actual para evitar re-renders infinitos
  const cajaMenorDelMesActual = useMemo(() => {
    const mesActual = obtenerMesActual();
    console.log('🔍 Frontend - Buscando caja menor del mes:', mesActual);
    console.log('🔍 Frontend - Total registros caja menor:', cajaMenorRecords.length);
    
    const encontrado = cajaMenorRecords.find(record => {
      const fechaRecord = record.fechaAnticipo?.substring(0, 7); // YYYY-MM
      console.log('🔍 Frontend - Comparando:', {
        fechaRecord,
        mesActual,
        coincide: fechaRecord === mesActual,
        beneficiario: record.beneficiario,
        concepto: record.concepto
      });
      return fechaRecord === mesActual;
    });
    
    console.log('🔍 Frontend - Caja menor encontrada del mes actual:', encontrado ? {
      id: encontrado.id,
      beneficiario: encontrado.beneficiario,
      valor: encontrado.valor,
      fecha: encontrado.fechaAnticipo
    } : 'NO ENCONTRADA');
    
    return encontrado;
  }, [cajaMenorRecords]);

  // Función para verificar si existe caja menor del mes actual
  const verificarCajaMenorMesActual = useCallback(() => {
    return cajaMenorDelMesActual;
  }, [cajaMenorDelMesActual]);

  // Actualizar el estado de caja menor actual cuando cambie
  useEffect(() => {
    setCajaMenorActual(cajaMenorDelMesActual || null);
  }, [cajaMenorDelMesActual]);

  // Memoizar el estado del botón de nueva caja menor
  const buttonState = useMemo(() => {
    const exists = !!cajaMenorDelMesActual;
    return {
      exists,
      className: exists
        ? 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white/80 cursor-not-allowed'
        : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-green-500/25',
      title: exists ? `Caja menor de ${obtenerMesActual()} ya registrada` : 'Crear nueva caja menor',
      text: exists ? 'Caja Menor Registrada' : 'Nueva Caja Menor',
      shortText: exists ? 'Registrada' : 'Caja',
      icon: exists ? 'CheckCircle' : 'DollarSign'
    };
  }, [cajaMenorDelMesActual]);

  // Memoizar el handler del botón de nueva caja menor
  const handleNuevaCajaMenor = useCallback(() => {
    if (cajaMenorDelMesActual) {
      alert(`❌ Ya existe una Caja Menor para ${obtenerMesActual()}\n\nBeneficiario: ${cajaMenorDelMesActual.beneficiario}\nValor: $${cajaMenorDelMesActual.valor?.toLocaleString('es-CO')}\n\n⚠️ Solo se permite una caja menor por mes y no es modificable.`);
    } else {
      setShowCajaMenorModal(true);
    }
  }, [cajaMenorDelMesActual]);

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
        console.log('📊 Registros Caja Menor válidos:', cajaMenorValidos.length);
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

  const handleSubmitCajaMenor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formCajaMenor.beneficiario || !formCajaMenor.concepto || formCajaMenor.valor <= 0) {
      alert('Por favor complete todos los campos');
      return;
    }

    // Verificar que no exista ya una caja menor del mes actual
    if (cajaMenorDelMesActual) {
      alert(`❌ Ya existe una Caja Menor registrada para ${obtenerMesActual()}.\n\nSolo se permite una caja menor por mes y no se puede modificar una vez creada.\n\nCaja Menor existente:\n- Beneficiario: ${cajaMenorDelMesActual.beneficiario}\n- Concepto: ${cajaMenorDelMesActual.concepto}\n- Valor: $${cajaMenorDelMesActual.valor?.toLocaleString('es-CO')}`);
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
        // Si es un error 409 (Conflict), significa que ya existe una caja menor del mes
        if (response.status === 409 && result.existingRecord) {
          alert(`❌ ${result.error}\n\nCaja Menor existente:\n- Beneficiario: ${result.existingRecord.beneficiario}\n- Valor: $${result.existingRecord.valor?.toLocaleString('es-CO')}\n- Mes: ${result.existingRecord.mes}\n\n⚠️ Solo se permite una caja menor por mes.`);
        } else {
          throw new Error(result.error || 'Error al crear la caja menor');
        }
        setLoading(false);
        return;
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
    
    // Verificar que existe caja menor del mes actual
    if (!cajaMenorDelMesActual) {
      alert('❌ Debe registrar una caja menor para el mes actual antes de registrar items.\n\nPor favor, cree primero la Caja Menor del mes.');
      setShowModal(false);
      setShowCajaMenorModal(true);
      return;
    }
    
    try {
      setLoading(true);
      console.log('📝 Enviando item de caja menor:', formData);
      
      // Crear el item y vincularlo automáticamente a la caja menor del mes actual
      const nuevoItem = {
        fecha: formData.fecha,
        beneficiario: formData.beneficiario,
        nitCC: formData.nitCC,
        concepto: formData.concepto,
        centroCosto: formData.centroCosto,
        valor: parseFloat(formData.valor) || 0,
        realizaRegistro: formData.realizaRegistro,
        cajaMenorId: cajaMenorDelMesActual.id // Vincular con la caja menor actual
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
      valor: '',
      realizaRegistro: userData?.nombre || 'Usuario'
    });
    setEditingItem(null);
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
        comprobante: undefined
      }))
  ];

  const itemsFiltrados = todosLosItems.filter(item => {
    // Validar que el item existe y tiene las propiedades necesarias
    if (!item || typeof item !== 'object') return false;
    
    // Si no hay caja menor del mes actual, no mostrar ningún registro
    if (!cajaMenorDelMesActual) return false;
    
    // Solo mostrar registros del mes actual
    const mesActual = obtenerMesActual();
    const fechaItem = item.fecha?.substring(0, 7); // YYYY-MM
    if (fechaItem !== mesActual) return false;
    
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

  // Calcular totales solo si existe caja menor del mes actual
  const totalIngresos = cajaMenorDelMesActual ? (cajaMenorDelMesActual.valor || 0) : 0;
  
  // Calcular egresos solo del mes actual si existe caja menor
  const totalEgresos = cajaMenorDelMesActual 
    ? itemsRecords
        .filter(item => {
          const mesActual = obtenerMesActual();
          const fechaItem = item.fecha?.substring(0, 7); // YYYY-MM
          return fechaItem === mesActual;
        })
        .reduce((sum, item) => sum + (item.valor || 0), 0)
    : 0;

  const saldoActual = totalIngresos - totalEgresos;

  // Debug: Log de estado actual
  console.log('📊 Estado Dashboard Caja Menor:', {
    cajaMenorDelMesActual: !!cajaMenorDelMesActual,
    mesActual: obtenerMesActual(),
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Tarjeta 1: Disponible Caja Menor */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                  <DollarSign className="w-7 h-7 text-green-400" />
                </div>
                {cajaMenorDelMesActual && (
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full border border-green-500/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-green-300">Activa</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70 mb-2">
                  {cajaMenorDelMesActual ? 'Disponible Caja Menor' : 'Sin Caja Menor'}
                </p>
                <p className="text-3xl font-bold text-green-400 mb-2">
                  ${totalIngresos.toLocaleString('es-CO')}
                </p>
                {cajaMenorDelMesActual ? (
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {cajaMenorDelMesActual.beneficiario}
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
          </div>

          {/* Alerta: No hay caja menor del mes actual */}
          {!cajaMenorDelMesActual && (
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-yellow-500/50 mb-8 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30 flex-shrink-0">
                  <AlertTriangle className="w-7 h-7 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-yellow-300 mb-1">
                    Caja Menor no registrada para {obtenerMesActual()}
                  </h3>
                  <p className="text-sm text-white/80">
                    Para registrar gastos, primero debe crear la caja menor del mes actual especificando quién estará a cargo y el monto disponible.
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

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <button
                  onClick={() => {
                    if (!cajaMenorDelMesActual) {
                      alert('Debe registrar una caja menor para el mes actual antes de registrar gastos');
                      setShowCajaMenorModal(true);
                    } else {
                      setShowModal(true);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-blue-500/25"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nuevo Gasto</span>
                </button>
                
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
                              {(() => {
                                try {
                                  if (!item.fecha) return 'Sin fecha';
                                  const fecha = new Date(item.fecha);
                                  return isNaN(fecha.getTime()) ? 'Fecha inválida' : fecha.toLocaleDateString('es-CO');
                                } catch {
                                  return 'Fecha inválida';
                                }
                              })()}
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
                    Nueva Caja Menor - {obtenerMesActual()}
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
                      ⚠️ IMPORTANTE - Solo UNA Caja Menor por Mes
                    </h4>
                    <p className="text-amber-200/90 text-xs leading-relaxed">
                      • Una vez registrada la caja menor del mes, <strong>NO se puede modificar</strong><br/>
                      • Solo se permite una caja menor por mes calendario<br/>
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
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      Beneficiario *
                    </label>
                    <input
                      type="text"
                      value={formData.beneficiario}
                      onChange={(e) => setFormData(prev => ({ ...prev, beneficiario: e.target.value }))}
                      placeholder="Nombre del beneficiario"
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-blue-400" />
                      NIT / CC
                    </label>
                    <input
                      type="text"
                      value={formData.nitCC}
                      onChange={(e) => setFormData(prev => ({ ...prev, nitCC: e.target.value }))}
                      placeholder="Número de identificación"
                      className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Concepto *
                  </label>
                  <input
                    type="text"
                    value={formData.concepto}
                    onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                    placeholder="Descripción del gasto"
                    className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-400" />
                    Centro de Costo
                  </label>
                  <input
                    type="text"
                    value={formData.centroCosto}
                    onChange={(e) => setFormData(prev => ({ ...prev, centroCosto: e.target.value }))}
                    placeholder="Departamento o área"
                    className="w-full px-4 py-3 bg-slate-700/60 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
                  />
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

                {cajaMenorDelMesActual && (
                  <div className="p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-blue-400 font-bold text-sm mb-1">
                          ✅ Se vinculará a la Caja Menor de {obtenerMesActual()}
                        </h4>
                        <p className="text-blue-200/90 text-xs leading-relaxed">
                          Responsable: <strong>{cajaMenorDelMesActual.beneficiario}</strong><br/>
                          Valor disponible: <strong>${cajaMenorDelMesActual.valor?.toLocaleString('es-CO')}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-semibold transition-colors shadow-lg"
                  >
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
                    Resumen de Caja Menor - {obtenerMesActual()}
                  </h3>
                  <p className="text-sm text-white/70">Estado actual del periodo</p>
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