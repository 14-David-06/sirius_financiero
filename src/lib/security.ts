import { NextRequest, NextResponse } from 'next/server';

// Rate limiting storage
const rateLimit = new Map<string, number[]>();

// Configuración de rate limiting
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS || '10');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000');

/**
 * Middleware de seguridad para APIs
 */
export class SecurityMiddleware {
  
  /**
   * Validar rate limiting por IP
   */
  static checkRateLimit(request: NextRequest): boolean {
    const ip = request.headers.get('x-forwarded-for') || 
              request.headers.get('x-real-ip') || 
              'unknown';
    const now = Date.now();
    
    const requests = rateLimit.get(ip) || [];
    const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT_REQUESTS) {
      return false;
    }
    
    rateLimit.set(ip, [...recentRequests, now]);
    return true;
  }
  
  /**
   * Sanitizar entrada de datos
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>'"]/g, '') // Remover caracteres peligrosos
      .trim()
      .slice(0, 1000); // Limitar longitud
  }
  
  /**
   * Validar formato de cédula
   */
  static validateCedula(cedula: string): boolean {
    const sanitized = this.sanitizeInput(cedula);
    return /^\d{6,12}$/.test(sanitized);
  }
  
  /**
   * Agregar headers de seguridad
   */
  static addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return response;
  }
  
  /**
   * Crear respuesta de error de rate limiting
   */
  static createRateLimitResponse(): NextResponse {
    const response = NextResponse.json(
      { 
        error: 'Demasiadas solicitudes. Intente nuevamente en un momento.',
        code: 'RATE_LIMIT_EXCEEDED' 
      },
      { status: 429 }
    );
    
    response.headers.set('Retry-After', '60');
    return this.addSecurityHeaders(response);
  }
  
  /**
   * Crear respuesta de error de validación
   */
  static createValidationErrorResponse(message: string): NextResponse {
    const response = NextResponse.json(
      { 
        error: message,
        code: 'VALIDATION_ERROR' 
      },
      { status: 400 }
    );
    
    return this.addSecurityHeaders(response);
  }
  
  /**
   * Logging seguro (sin datos sensibles)
   */
  static secureLog(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...(data && { data: this.sanitizeLogData(data) })
    };
    
    console[level](JSON.stringify(logData));
  }
  
  /**
   * Sanitizar datos para logging
   */
  private static sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sanitized = { ...data };
    
    // Remover campos sensibles
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'cedula', 'api_key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Validar configuración de variables de entorno
   */
  static validateEnvironment(): boolean {
    const required = ['AIRTABLE_BASE_ID', 'AIRTABLE_API_KEY'];
    
    for (const variable of required) {
      if (!process.env[variable]) {
        this.secureLog('error', `Variable de entorno requerida no encontrada: ${variable}`);
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Decorator para proteger rutas API
 */
export function withSecurity(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Validar variables de entorno
      if (!SecurityMiddleware.validateEnvironment()) {
        return SecurityMiddleware.createValidationErrorResponse('Configuración del servidor incompleta');
      }
      
      // Aplicar rate limiting
      if (!SecurityMiddleware.checkRateLimit(request)) {
        SecurityMiddleware.secureLog('warn', 'Rate limit exceeded', { 
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          url: request.url 
        });
        return SecurityMiddleware.createRateLimitResponse();
      }
      
      // Ejecutar handler
      const response = await handler(request);
      
      // Agregar headers de seguridad
      return SecurityMiddleware.addSecurityHeaders(response);
      
    } catch (error) {
      SecurityMiddleware.secureLog('error', 'Error en middleware de seguridad', { error });
      
      const response = NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
      
      return SecurityMiddleware.addSecurityHeaders(response);
    }
  };
}
