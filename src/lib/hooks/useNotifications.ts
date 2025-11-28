'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserData } from '@/types/compras';

interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

export function useNotifications(userData: UserData | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Solicitar permiso para notificaciones push
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Este navegador no soporta notificaciones');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error solicitando permiso de notificaciones:', error);
      return false;
    }
  }, []);

  // Mostrar notificación push
  const showNotification = useCallback((data: NotificationData) => {
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones no concedido');
      return;
    }

    try {
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/favicon.ico',
        tag: data.tag || 'sirius-notification',
        requireInteraction: false,
        silent: false
      });

      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Manejar click en la notificación
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

    } catch (error) {
      console.error('Error mostrando notificación:', error);
    }
  }, [permission]);

  // Mostrar toast notification in-app
  const showToastNotification = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);

    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  }, []);

  // Verificar estado del permiso al montar
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  return {
    permission,
    requestPermission,
    showNotification,
    showToastNotification,
    showToast,
    toastMessage,
    hideToast: () => setShowToast(false)
  };
}