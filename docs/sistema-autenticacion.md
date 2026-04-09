# Sistema de Autenticación Sirius Financiero

## Descripción General

El sistema de autenticación implementado proporciona un flujo de login seguro basado en la tabla de "Equipo Financiero" de Airtable, con manejo de contraseñas encriptadas y tokens JWT.

## Flujo de Autenticación

### 1. **Ingreso de Cédula** 
- El usuario ingresa su número de cédula en el landing page
- Se valida que la cédula exista en la tabla "Equipo Financiero" 
- Se verifica que el usuario esté activo (`Estado Usuario = "Activo"`)

### 2. **Configuración de Contraseña (Primera vez)**
- Si el usuario no tiene contraseña configurada (campos `Hash` y `Salt` vacíos)
- Se solicita crear una contraseña segura (mínimo 8 caracteres)
- La contraseña se encripta con bcryptjs y se almacena en Airtable

### 3. **Login con Contraseña**
- Si el usuario ya tiene contraseña configurada
- Se solicita la contraseña y se valida contra el hash almacenado
- Se genera un token JWT válido por 24 horas

### 4. **Control de Acceso por Roles**
- **Colaboradores**: Acceso solo a "Solicitudes de Compra"
- **Administrador/Gerencia/Desarrollador**: Acceso a "Monitoreo de Solicitudes"

## Componentes Principales

### APIs (`/src/app/api/`)
- **`validate-user/route.ts`**: Valida cédula y estado del usuario
- **`setup-password/route.ts`**: Configura contraseña por primera vez  
- **`authenticate/route.ts`**: Maneja el login y genera tokens JWT
- **`logout/route.ts`**: Cierra la sesión del usuario

### Componentes React (`/src/components/`)
- **`LoginComponent.tsx`**: Componente principal de autenticación
- **`LandingPage.tsx`**: Página de inicio con login integrado
- **`layout/Navbar.tsx`**: Navegación con información del usuario
- **`SessionIndicator.tsx`**: Indicador de tiempo de sesión

### Middleware (`middleware.ts`)
- Protege rutas que requieren autenticación
- Verifica tokens JWT automáticamente
- Redirige usuarios no autorizados

### Hooks (`/src/lib/hooks/`)
- **`useAuthSession.ts`**: Hook para gestionar estado de autenticación

## Campos de Airtable Requeridos

### Tabla: Equipo Financiero (`tblXXXXXXXXXXXXX12`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Cedula` | Text | Número de cédula del usuario |
| `Nombre` | Text | Nombre completo del usuario |
| `Estado Usuario` | Single Select | "Activo" o "Inactivo" |
| `Categoria Usuario` | Single Select | "Colaborador", "Administrador", "Gerencia", "Desarrollador" |
| `Hash` | Long Text | Hash de la contraseña (bcryptjs) |
| `Salt` | Long Text | Salt para la contraseña |
| `ID_Chat` | Text | ID de chat del usuario |

## Variables de Entorno

```bash
# Configuración de Airtable
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX.XXXX
AIRTABLE_TEAM_TABLE_NAME=Equipo Financiero

# Configuración JWT
JWT_SECRET=your_very_secure_jwt_secret_key_here
```

## Características de Seguridad

### 🔒 Encriptación
- Contraseñas hasheadas con bcryptjs (salt rounds: 12)
- Tokens JWT con expiración de 24 horas
- Cookies HTTPOnly, Secure, SameSite

### 🚦 Rate Limiting  
- Login: 5 intentos cada 5 minutos
- Validación: 5 intentos por minuto
- Setup password: 3 intentos por minuto

### 🛡️ Validaciones
- Formato de cédula colombiana
- Sanitización de entradas
- Escape de consultas a Airtable
- Headers de seguridad

### 📊 Logging
- Registro seguro de eventos de autenticación
- No se logean contraseñas o datos sensibles
- Tracking de IPs para rate limiting

## Estados de Usuario

### ✅ **Activo**
- Puede hacer login normalmente
- Acceso según su categoría

### ❌ **Inactivo** 
- No puede hacer login
- Mensaje: "Usuario inactivo. Contacte al administrador."

### 🆕 **Sin Contraseña**
- Primer acceso al sistema
- Debe configurar contraseña segura

## Flujo de Redirección

1. **Login exitoso** → Redirige según categoría:
   - Administrador/Gerencia → `/monitoreo-solicitudes`
   - Otros → `/solicitudes-compra`

2. **Sin autenticación** → Redirige a `/` (landing page)

3. **Token expirado** → Redirige a `/` y limpia cookies

## Instalación de Dependencias

```bash
npm install bcryptjs jsonwebtoken @types/bcryptjs @types/jsonwebtoken
```

## Uso

1. Configurar variables de entorno en `.env.local`
2. Asegurar que la tabla "Equipo Financiero" existe en Airtable
3. Los usuarios pueden acceder con su cédula
4. En el primer acceso configurarán su contraseña
5. Accesos posteriores requieren cédula + contraseña

## Notas Importantes

- La cédula debe existir previamente en Airtable
- Solo usuarios con `Estado Usuario = "Activo"` pueden acceder
- Las contraseñas se almacenan de forma segura (nunca en texto plano)
- El sistema maneja automáticamente expiración de sesiones
- Implementa protección contra ataques de fuerza bruta
