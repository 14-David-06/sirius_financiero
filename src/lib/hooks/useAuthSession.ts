"use client";

import { useState, useEffect } from 'react';
import { UserData } from '@/types/compras';

interface AuthSession {
  user: UserData;
  timestamp: number;
  expiresAt: number;
}

export function useAuthSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Duración de la sesión en milisegundos (24 horas)
  const SESSION_DURATION = 24 * 60 * 60 * 1000;
  const STORAGE_KEY = 'sirius_auth_session';

  // Verificar si hay una sesión válida al cargar
  useEffect(() => {
    checkExistingSession();
    
    // Escuchar cambios de estado de autenticación
    const handleAuthStateChange = (event: CustomEvent) => {
      const { isAuthenticated, user } = event.detail;
      setIsAuthenticated(isAuthenticated);
      setUserData(user);
      setIsLoading(false);
    };

    // Escuchar eventos de forzar verificación
    const handleForceAuthCheck = () => {
      checkExistingSession();
    };

    window.addEventListener('authStateChanged', handleAuthStateChange as EventListener);
    window.addEventListener('forceAuthCheck', handleForceAuthCheck);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange as EventListener);
      window.removeEventListener('forceAuthCheck', handleForceAuthCheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkExistingSession = async () => {
    try {
      // Primero verificar si hay una sesión local válida
      const storedSession = localStorage.getItem(STORAGE_KEY);
      
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);
        const now = Date.now();
        
        // Verificar si la sesión no ha expirado
        if (now < session.expiresAt) {
          setUserData(session.user);
          setIsAuthenticated(true);
          console.log('Sesión válida encontrada, usuario autenticado automáticamente');
          setIsLoading(false);
          return;
        } else {
          // Sesión expirada, limpiar
          localStorage.removeItem(STORAGE_KEY);
          console.log('Sesión expirada, requiere nueva autenticación');
        }
      }

      // Si no hay sesión local válida, verificar si hay una cookie de servidor válida
      try {
        const response = await fetch('/api/check-session', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            // Crear sesión local basada en la sesión del servidor
            const now = Date.now();
            const session: AuthSession = {
              user: data.user,
              timestamp: now,
              expiresAt: now + SESSION_DURATION
            };
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            setUserData(data.user);
            setIsAuthenticated(true);
            console.log('Sesión del servidor encontrada, sincronizada localmente');
          }
        }
      } catch {
        console.log('No hay sesión del servidor válida');
      }

    } catch {
      console.error('Error al verificar sesión existente');
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (user: UserData) => {
    const now = Date.now();
    const session: AuthSession = {
      user,
      timestamp: now,
      expiresAt: now + SESSION_DURATION
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      
      // Actualizar el estado inmediatamente
      setUserData(user);
      setIsAuthenticated(true);
      setIsLoading(false);
      
      console.log('Sesión iniciada y guardada');
      
      // Disparar evento personalizado para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { isAuthenticated: true, user } 
      }));
    } catch (error) {
      console.error('Error al guardar sesión:', error);
    }
  };

  const logout = async () => {
    try {
      // Intentar hacer logout en el servidor también
      await fetch('/api/logout', { method: 'POST' }).catch(() => {
        // Si falla, solo continuamos con el logout local
      });
      
      localStorage.removeItem(STORAGE_KEY);
      setUserData(null);
      setIsAuthenticated(false);
      
      // Disparar evento personalizado para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { isAuthenticated: false, user: null } 
      }));
      
      // Redirigir al home
      window.location.href = '/';
      console.log('Sesión cerrada');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const extendSession = () => {
    if (isAuthenticated && userData) {
      const now = Date.now();
      const session: AuthSession = {
        user: userData,
        timestamp: now,
        expiresAt: now + SESSION_DURATION
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        console.log('Sesión extendida');
      } catch (error) {
        console.error('Error al extender sesión:', error);
      }
    }
  };

  const getRemainingTime = (): number => {
    try {
      const storedSession = localStorage.getItem(STORAGE_KEY);
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);
        return Math.max(0, session.expiresAt - Date.now());
      }
    } catch (error) {
      console.error('Error al obtener tiempo restante:', error);
    }
    return 0;
  };

  return {
    isAuthenticated,
    userData,
    isLoading,
    login,
    logout,
    extendSession,
    getRemainingTime
  };
}
