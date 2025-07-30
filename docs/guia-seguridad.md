# 🔒 Guía de Seguridad - Sirius Financiero

## ⚠️ INFORMACIÓN CRÍTICA DE SEGURIDAD

Este proyecto maneja información sensible y credenciales de acceso a servicios externos. Es fundamental seguir estas prácticas de seguridad.

## 🚫 NUNCA Hacer

### ❌ NO subir credenciales al repositorio
- No incluir archivos `.env.local` o similares con credenciales reales
- No hardcodear API keys, tokens o contraseñas en el código
- No publicar credenciales en documentación o comentarios

### ❌ NO compartir credenciales en texto plano
- No enviar credenciales por email, chat o documentos
- No almacenar credenciales en archivos no cifrados
- No capturar pantallas que muestren credenciales

## ✅ SÍ Hacer

### ✅ Usar variables de entorno
```bash
# Correcto - en .env.local (NO subir al repo)
AIRTABLE_API_KEY=tu_api_key_real_aqui
AWS_ACCESS_KEY_ID=tu_access_key_aqui

# Correcto - en el código
const apiKey = process.env.AIRTABLE_API_KEY;
```

### ✅ Usar archivo de ejemplo
```bash
# En .env.example (SÍ subir al repo)
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX.XXXXXXXXX
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
```

## 📁 Archivos de Configuración

### 🔓 Archivos SEGUROS para el repositorio:
- `.env.example` - Plantilla sin credenciales reales
- `README.md` - Documentación general
- Archivos de código fuente (sin credenciales hardcodeadas)

### 🔒 Archivos que NO deben subirse:
- `.env.local` - Credenciales reales de desarrollo
- `.env.production` - Credenciales de producción
- `credentials/` - Cualquier archivo con credenciales
- `secrets/` - Archivos de secretos

## 🛠️ Configuración Inicial

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/sirius_financiero.git
cd sirius_financiero
```

### 2. Configurar variables de entorno
```bash
# Copiar plantilla
cp .env.example .env.local

# Editar con tus credenciales reales
# IMPORTANTE: Nunca subir este archivo al repositorio
```

### 3. Verificar .gitignore
El archivo `.gitignore` debe incluir:
```
# Environment variables - CRÍTICO
.env*
!.env.example
*.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

## 🔑 Gestión de Credenciales por Servicio

### AWS S3
```bash
AWS_ACCESS_KEY_ID=AKIA...          # Access Key ID (20 chars)
AWS_SECRET_ACCESS_KEY=...          # Secret Key (40 chars)
AWS_REGION=us-east-1               # Región de AWS
AWS_S3_BUCKET=tu-bucket            # Nombre del bucket
```

### Airtable
```bash
AIRTABLE_API_KEY=pat...            # Personal Access Token
AIRTABLE_BASE_ID=app...            # Base ID (17 chars)
AIRTABLE_TABLE_NAME=...            # Nombre de la tabla
```

### OpenAI
```bash
OPENAI_API_KEY=sk-proj-...         # API Key de OpenAI
```

## 🚨 En Caso de Compromiso

Si sospechas que una credencial ha sido comprometida:

1. **Rotar inmediatamente** la credencial en el servicio original
2. **Actualizar** la variable de entorno con la nueva credencial
3. **Revisar logs** de acceso para actividad sospechosa
4. **Notificar** al equipo de desarrollo

## 📞 Contacto de Seguridad

En caso de incidentes de seguridad, contactar a:
- Administrador del sistema
- Responsable de DevOps
- Líder técnico del proyecto

---

**Recuerda**: La seguridad es responsabilidad de todo el equipo. Ante la duda, siempre consultar antes de proceder.
