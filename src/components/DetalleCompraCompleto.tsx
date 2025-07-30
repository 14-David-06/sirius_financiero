'use client';

import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { CompraCompleta, CompraItem, AirtableField } from '@/types/compras';

interface DetalleCompraCompletoProps {
  compra: CompraCompleta;
  onClose: () => void;
}

const DetalleCompraCompleto: React.FC<DetalleCompraCompletoProps> = ({ compra, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'financiero' | 'proveedor' | 'items'>('general');
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});
  const [itemStates, setItemStates] = useState<Record<string, string>>(() => {
    const initialStates: Record<string, string> = {};
    compra.items.forEach(item => {
      initialStates[item.id] = item.estadoItem || 'Sin comprar';
    });
    return initialStates;
  });

  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Aprobado':
        return 'bg-green-100 text-green-800';
      case 'Rechazado':
        return 'bg-red-100 text-red-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Comprado':
        return 'bg-green-100 text-green-800'; // Verde para comprado
      case 'Sin comprar':
        return 'bg-red-100 text-red-800'; // Rojo para sin comprar
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const updateItemEstado = async (itemId: string, nuevoEstado: string) => {
    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));
    
    try {
      const response = await fetch('/api/items/update-estado', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          estadoItem: nuevoEstado
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }

      const result = await response.json();
      
      // Actualizar el estado local
      setItemStates(prev => ({ ...prev, [itemId]: nuevoEstado }));
      
      // Mostrar mensaje de éxito (puedes usar una librería de notificaciones aquí)
      console.log('Estado actualizado exitosamente:', result.message);
      
    } catch (error) {
      console.error('Error al actualizar estado del item:', error);
      // Mostrar mensaje de error (puedes usar una librería de notificaciones aquí)
      alert('Error al actualizar el estado del item: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const renderArrayField = (field: string[] | number[] | undefined, label: string) => {
    if (!field || (Array.isArray(field) && field.length === 0)) return null;
    const value = Array.isArray(field) ? field.join(', ') : field;
    return (
      <div className="mb-2">
        <span className="font-medium text-gray-700">{label}:</span>
        <span className="ml-2 text-gray-900">{value}</span>
      </div>
    );
  };

  const renderGeneralTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Información de la Solicitud</h4>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-700">Fecha de Solicitud:</span>
              <span className="ml-2 text-gray-900">{formatDate(compra.fechaSolicitud)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Área:</span>
              <span className="ml-2 text-gray-900">{compra.areaCorrespondiente}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Solicitante:</span>
              <span className="ml-2 text-gray-900">{compra.nombreSolicitante}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Cargo:</span>
              <span className="ml-2 text-gray-900">{compra.cargoSolicitante}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Estado:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(compra.estadoSolicitud)}`}>
                {compra.estadoSolicitud}
              </span>
            </div>
            {compra.nombresAdmin && (
              <div>
                <span className="font-medium text-gray-700">Aprobado/Rechazado por:</span>
                <span className="ml-2 text-gray-900 font-medium">{compra.nombresAdmin}</span>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Documentos</h4>
          <div className="space-y-2">
            {compra.documentoSolicitud && (
              <div>
                <a 
                  href={compra.documentoSolicitud} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  📄 Ver Documento de Solicitud
                </a>
              </div>
            )}
            {compra.cotizacionDoc && (
              <div>
                <a 
                  href={compra.cotizacionDoc} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  📋 Ver Cotización
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">Descripción de la Solicitud</h4>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{compra.descripcionSolicitud}</p>
        </div>
      </div>
      
      {compra.descripcionIA && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Interpretación IA</h4>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{compra.descripcionIA}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderFinancieroTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Información Financiera</h4>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-700">Valor Total:</span>
              <span className="ml-2 text-gray-900 font-semibold">{formatCurrency(compra.valorTotal)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">IVA:</span>
              <span className="ml-2 text-gray-900">{formatCurrency(compra.iva)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Retención:</span>
              <span className="ml-2 text-gray-900">{formatCurrency(compra.retencion)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Neto:</span>
              <span className="ml-2 text-gray-900 font-semibold text-lg">{formatCurrency(compra.totalNeto)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Valor UVT:</span>
              <span className="ml-2 text-gray-900">{formatCurrency(compra.valorUVT)}</span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Información de Base Mínima</h4>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-700">Base Mínima UVT:</span>
              <span className="ml-2 text-gray-900">{compra.baseMinimaEnUVT}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Base Mínima Pesos:</span>
              <span className="ml-2 text-gray-900">{formatCurrency(compra.baseMinimaEnPesos)}</span>
            </div>
            {renderArrayField(compra.compraServicio, 'Tipo de Compra/Servicio')}
          </div>
        </div>
      </div>
      
      {(compra.numeroSemanaBancario || compra.clasificacionBancaria || compra.valorBancario) && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Información Bancaria</h4>
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            {renderArrayField(compra.numeroSemanaBancario, 'Número de Semana')}
            {renderArrayField(compra.clasificacionBancaria, 'Clasificación')}
            {renderArrayField(compra.valorBancario, 'Valor Bancario')}
            {renderArrayField(compra.proyeccionBancaria, 'Proyección')}
          </div>
        </div>
      )}
    </div>
  );

  const renderProveedorTab = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">Información del Proveedor</h4>
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          {compra.razonSocialProveedor && (
            <div>
              <span className="font-medium text-gray-700">Razón Social:</span>
              <span className="ml-2 text-gray-900">{compra.razonSocialProveedor}</span>
            </div>
          )}
          {renderArrayField(compra.nombreProveedor, 'Nombre Completo')}
          {renderArrayField(compra.nitProveedor, 'NIT/CC')}
          {renderArrayField(compra.ciudadProveedor, 'Ciudad')}
          {renderArrayField(compra.departamentoProveedor, 'Departamento')}
          {renderArrayField(compra.personaProveedor, 'Tipo de Persona')}
          {renderArrayField(compra.contribuyente, 'Contribuyente')}
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">Información Tributaria</h4>
        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          {renderArrayField(compra.autoretenedor, 'Autoretenedor')}
          {renderArrayField(compra.responsableIVA, 'Responsable IVA')}
          {renderArrayField(compra.responsableICA, 'Responsable ICA')}
          {renderArrayField(compra.tarifaActividad, 'Tarifa de Actividad')}
          {renderArrayField(compra.facturadorElectronico, 'Facturador Electrónico')}
          {renderArrayField(compra.declaranteRenta, 'Declarante de Renta')}
        </div>
      </div>
      
      {compra.rutProveedor && compra.rutProveedor.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Documentos del Proveedor</h4>
          <div className="space-y-2">
            {compra.rutProveedor.map((rut: AirtableField, index: number) => (
              <div key={index}>
                <a 
                  href={rut.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  📄 {rut.filename || 'RUT del Proveedor'}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-800 mb-2">Items de la Compra ({compra.items.length})</h4>
      
      {compra.items.map((item: CompraItem, index: number) => (
        <Card key={item.id} className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <h5 className="font-medium text-gray-800">Item #{index + 1}</h5>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(itemStates[item.id])}`}>
                {itemStates[item.id] || 'Sin comprar'}
              </span>
            </div>
            <span className="text-sm text-gray-600">ID: {item.id}</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-gray-700">Objeto:</span>
                  <span className="ml-2 text-gray-900">{item.objeto}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Centro de Costos:</span>
                  <span className="ml-2 text-gray-900">{item.centroCostos}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Cantidad:</span>
                  <span className="ml-2 text-gray-900">{item.cantidad}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Valor:</span>
                  <span className="ml-2 text-gray-900 font-semibold">{formatCurrency(item.valorItem)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Tipo:</span>
                  <span className="ml-2 text-gray-900">{item.compraServicio}</span>
                </div>
              </div>
            </div>
            
            <div>
              <div className="space-y-2">
                {item.prioridad && (
                  <div>
                    <span className="font-medium text-gray-700">Prioridad:</span>
                    <span className="ml-2 text-gray-900">{item.prioridad}</span>
                  </div>
                )}
                {item.fechaRequerida && (
                  <div>
                    <span className="font-medium text-gray-700">Fecha Requerida:</span>
                    <span className="ml-2 text-gray-900">{formatDate(item.fechaRequerida)}</span>
                  </div>
                )}
                {item.formaPago && (
                  <div>
                    <span className="font-medium text-gray-700">Forma de Pago:</span>
                    <span className="ml-2 text-gray-900">{item.formaPago}</span>
                  </div>
                )}
                {item.aprobacion && (
                  <div>
                    <span className="font-medium text-gray-700">Aprobación:</span>
                    <span className="ml-2 text-gray-900">{item.aprobacion}</span>
                  </div>
                )}
                {item.estadoGestion && (
                  <div>
                    <span className="font-medium text-gray-700">Estado de Gestión:</span>
                    <span className="ml-2 text-gray-900">{item.estadoGestion}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {(item.reciboRemision || item.transporte) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h6 className="font-medium text-gray-700 mb-2">Información Adicional</h6>
              {item.reciboRemision && (
                <div className="mb-2">
                  <span className="font-medium text-gray-700">Recibo/Remisión:</span>
                  <p className="text-gray-900 text-sm mt-1">{item.reciboRemision}</p>
                </div>
              )}
              {item.transporte && (
                <div>
                  <span className="font-medium text-gray-700">Transporte:</span>
                  <p className="text-gray-900 text-sm mt-1">{item.transporte}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Sección para actualizar estado del item */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h6 className="font-medium text-gray-700 mb-3">Actualizar Estado del Item</h6>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Estado actual:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(itemStates[item.id])}`}>
                {itemStates[item.id] || 'Sin comprar'}
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => updateItemEstado(item.id, 'Sin comprar')}
                disabled={updatingItems[item.id] || itemStates[item.id] === 'Sin comprar'}
                size="sm"
                variant={itemStates[item.id] === 'Sin comprar' ? 'primary' : 'secondary'}
              >
                {updatingItems[item.id] ? 'Actualizando...' : 'Sin comprar'}
              </Button>
              <Button
                onClick={() => updateItemEstado(item.id, 'Comprado')}
                disabled={updatingItems[item.id] || itemStates[item.id] === 'Comprado'}
                size="sm"
                variant={itemStates[item.id] === 'Comprado' ? 'primary' : 'secondary'}
              >
                {updatingItems[item.id] ? 'Actualizando...' : 'Comprado'}
              </Button>
            </div>
          </div>
          
          {item.nombreProveedor && item.nombreProveedor.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h6 className="font-medium text-gray-700 mb-2">Proveedor del Item</h6>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                {renderArrayField(item.nombreProveedor, 'Nombre')}
                {renderArrayField(item.nitProveedor, 'NIT/CC')}
                {renderArrayField(item.correoProveedor, 'Correo')}
                {renderArrayField(item.celularProveedor, 'Celular')}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden mx-2 sm:mx-0">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 truncate mr-2">
            Detalle Completo - {compra.nombreSolicitante}
          </h2>
          <Button onClick={onClose} variant="ghost" size="sm" className="flex-shrink-0">
            ✕
          </Button>
        </div>
        
        <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'general'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('financiero')}
            className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'financiero'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Financiero
          </button>
          <button
            onClick={() => setActiveTab('proveedor')}
            className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'proveedor'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Proveedor
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
              activeTab === 'items'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Items ({compra.items.length})
          </button>
        </div>
        
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-140px)]">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'financiero' && renderFinancieroTab()}
          {activeTab === 'proveedor' && renderProveedorTab()}
          {activeTab === 'items' && renderItemsTab()}
        </div>
      </div>
    </div>
  );
};

export default DetalleCompraCompleto;
