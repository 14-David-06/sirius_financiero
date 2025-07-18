'use client';

import { useState, useEffect } from 'react';

interface UserData {
  cedula: string;
  nombre: string;
  cargo: string;
  area: string;
  email: string;
}

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
  }, []);

  const checkExistingSession = () => {
    try {
      const storedSession = localStorage.getItem(STORAGE_KEY);
      
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);
        const now = Date.now();
        
        // Verificar si la sesión no ha expirado
        if (now < session.expiresAt) {
          setUserData(session.user);
          setIsAuthenticated(true);
          console.log('Sesión válida encontrada, usuario autenticado automáticamente');
        } else {
          // Sesión expirada, limpiar
          localStorage.removeItem(STORAGE_KEY);
          console.log('Sesión expirada, requiere nueva autenticación');
        }
      }
    } catch (error) {
      console.error('Error al verificar sesión existente:', error);
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
      setUserData(user);
      setIsAuthenticated(true);
      console.log('Sesión iniciada y guardada');
    } catch (error) {
      console.error('Error al guardar sesión:', error);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setUserData(null);
      setIsAuthenticated(false);
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
