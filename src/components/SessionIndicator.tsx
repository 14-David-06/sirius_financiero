'use client';

import { useState, useEffect } from 'react';

interface SessionIndicatorProps {
  getRemainingTime: () => number;
  extendSession: () => void;
  onLogout: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SessionIndicator({ getRemainingTime, extendSession, onLogout }: SessionIndicatorProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showExtendOption, setShowExtendOption] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const remaining = getRemainingTime();
      setTimeRemaining(remaining);
      
      // Mostrar opción de extender cuando queden menos de 30 minutos
      setShowExtendOption(remaining < 30 * 60 * 1000 && remaining > 0);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, [getRemainingTime]);

  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleExtendSession = () => {
    extendSession();
    setShowExtendOption(false);
  };

  if (timeRemaining <= 0) {
    return null;
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-white/90">
            Sesión activa: {formatTime(timeRemaining)}
          </span>
        </div>
        
        {showExtendOption && (
          <button
            onClick={handleExtendSession}
            className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            Extender 24h
          </button>
        )}
      </div>
      
      {timeRemaining < 10 * 60 * 1000 && ( // Menos de 10 minutos
        <div className="mt-2 text-xs text-yellow-300">
          ⚠️ Su sesión expirará pronto
        </div>
      )}
    </div>
  );
}
