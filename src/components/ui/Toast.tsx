'use client';

import { useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export default function Toast({ message, isVisible, onClose, type = 'info' }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500/90 border-green-400/50';
      case 'warning':
        return 'bg-yellow-500/90 border-yellow-400/50';
      case 'error':
        return 'bg-red-500/90 border-red-400/50';
      default:
        return 'bg-blue-500/90 border-blue-400/50';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className={`${getToastStyles()} backdrop-blur-md border rounded-lg p-4 shadow-xl max-w-sm`}>
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}