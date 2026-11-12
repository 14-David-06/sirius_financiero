import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { normalizarCategoria, type Categoria } from './roles';

export interface UsuarioSesion {
  cedula: string;
  nombre: string;
  categoria: Categoria;
}

/**
 * Valida la cookie de sesión dentro de una ruta API: el middleware excluye /api.
 * Sin JWT_SECRET no se acepta ningún token (no hay secreto por defecto).
 */
export function obtenerUsuarioSesion(request: NextRequest): UsuarioSesion | null {
  const token = request.cookies.get('auth-token')?.value;
  const secreto = process.env.JWT_SECRET;
  if (!token || !secreto) return null;

  try {
    const decoded = jwt.verify(token, secreto) as Record<string, unknown>;
    return {
      cedula: String(decoded.cedula ?? ''),
      nombre: String(decoded.nombre ?? ''),
      categoria: normalizarCategoria(
        typeof decoded.categoria === 'string' ? decoded.categoria : undefined,
        decoded.nivelAcceso
      ),
    };
  } catch {
    return null;
  }
}
