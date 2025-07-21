/**
 * 🔒 MÓDULO DE VALIDACIÓN Y SANITIZACIÓN DE SEGURIDAD
 * Implementa validación estricta para prevenir inyecciones y ataques
 */

// Validación de cédula colombiana
export const validateCedula = (cedula: string): boolean => {
  if (!cedula || typeof cedula !== 'string') return false;
  
  // Remover espacios y caracteres no numéricos
  const cleanCedula = cedula.replace(/\D/g, '');
  
  // Validar longitud (6-12 dígitos para Colombia)
  if (cleanCedula.length < 6 || cleanCedula.length > 12) return false;
  
  // Validar que no sean todos ceros o números repetidos
  if (/^0+$/.test(cleanCedula) || /^(\d)\1+$/.test(cleanCedula)) return false;
  
  return true;
};

// Sanitización de entrada de texto
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>'"]/g, '') // Remover caracteres peligrosos HTML/JS
    .replace(/[;&|`$(){}[\]\\]/g, '') // Remover caracteres de comando
    .replace(/\x00/g, '') // Remover null bytes
    .trim() // Remover espacios al inicio/final
    .substring(0, 1000); // Limitar longitud
};

// Validación de email
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 320;
};

// Validación de nombres
export const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  
  const cleanName = name.trim();
  // Solo letras, espacios, acentos y guiones
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s-]+$/;
  
  return nameRegex.test(cleanName) && 
         cleanName.length >= 2 && 
         cleanName.length <= 100;
};

// Validación de números de teléfono colombiano
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  
  const cleanPhone = phone.replace(/\D/g, '');
  // Formato colombiano: 10 dígitos o con código país (+57)
  return /^(57)?[3][0-9]{9}$/.test(cleanPhone);
};

// Validación de archivos
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (!file) return { valid: false, error: 'No se proporcionó archivo' };
  
  // Tipos permitidos
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'audio/wav',
    'audio/mp3',
    'audio/mpeg'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de archivo no permitido' };
  }
  
  // Tamaño máximo: 10MB
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'Archivo demasiado grande (máx. 10MB)' };
  }
  
  return { valid: true };
};

// Escape para consultas Airtable
export const escapeAirtableQuery = (value: string): string => {
  return value
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\\/g, '\\\\');
};

// Validación de estado de compra
export const validateCompraStatus = (status: string): boolean => {
  const validStatuses = [
    'Pendiente',
    'En Revisión',
    'Aprobada',
    'Rechazada',
    'En Proceso',
    'Completada'
  ];
  
  return validStatuses.includes(status);
};

// Rate limiting simple en memoria
const rateLimitMap = new Map<string, number[]>();

export const checkRateLimit = (identifier: string, maxRequests = 10, windowMs = 60000): boolean => {
  const now = Date.now();
  const requests = rateLimitMap.get(identifier) || [];
  
  // Filtrar requests dentro de la ventana de tiempo
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false; // Rate limit excedido
  }
  
  // Agregar el request actual
  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);
  
  // Limpiar entradas viejas cada 5 minutos
  if (Math.random() < 0.1) {
    for (const [key, times] of rateLimitMap.entries()) {
      const validTimes = times.filter(time => now - time < windowMs);
      if (validTimes.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, validTimes);
      }
    }
  }
  
  return true;
};

// Headers de seguridad
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Logging seguro (enmascarar datos sensibles)
export const secureLog = (message: string, data?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'production') {
    // En producción, no loggear datos sensibles
    console.log(message);
  } else {
    // En desarrollo, loggear pero enmascarar datos sensibles
    const safeData = data ? maskSensitiveData(data) : undefined;
    console.log(message, safeData);
  }
};

// Enmascarar datos sensibles
const maskSensitiveData = (data: Record<string, unknown>): Record<string, unknown> => {
  if (typeof data !== 'object' || data === null) return data;
  
  const masked = { ...data };
  const sensitiveKeys = ['cedula', 'password', 'token', 'api_key', 'telefono', 'email'];
  
  for (const key in masked) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      if (typeof masked[key] === 'string' && masked[key].length > 4) {
        masked[key] = masked[key].substring(0, 2) + '***' + masked[key].substring(masked[key].length - 2);
      }
    }
  }
  
  return masked;
};

const validationUtils = {
  validateCedula,
  sanitizeInput,
  validateEmail,
  validateName,
  validatePhone,
  validateFile,
  escapeAirtableQuery,
  validateCompraStatus,
  checkRateLimit,
  securityHeaders,
  secureLog,
  maskSensitiveData
};

export default validationUtils;
