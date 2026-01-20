# Sirius Financiero

Plataforma integral para la gestión financiera empresarial con interfaz minimalista y moderna, enfocada en la optimización de procesos de compra y monitoreo de solicitudes.

## 🔒 Información de Seguridad

> ⚠️ **IMPORTANTE**: Este proyecto maneja información sensible. Consulta la [Guía de Seguridad](docs/guia-seguridad.md) antes de configurar.

- 🛡️ **Variables de Entorno**: Todas las credenciales usan variables de entorno
- 🚫 **Sin Credenciales Hardcodeadas**: Código fuente libre de información sensible  
- 📋 **Configuración Segura**: Ver [Estado de Seguridad](docs/estado-seguridad.md)
- 🔍 **Verificación Automática**: Script `scripts/security-verify.ps1` disponible

## 🎨 Diseño Minimalista

- **Interfaz Limpia**: Diseño minimalista centrado en la funcionalidad
- **Fondo Elegante**: Imagen de fondo personalizada con efectos glass morphism
- **Colores Sutiles**: Paleta de colores suaves con gradientes transparentes
- **Tipografía Clara**: Fuentes optimizadas para legibilidad

## 🚀 Características Principales

### 🏠 Landing Page
- Diseño minimalista con imagen de fondo personalizada
- Efectos glass morphism y backdrop blur
- Navegación intuitiva sin elementos innecesarios
- Llamadas a la acción claras y directas

### 📋 Solicitudes de Compra
- **Formulario Inteligente**: Basado en usuarios predefinidos con datos automáticos
- **Gestión de Ítems**: Agregar/eliminar múltiples ítems dinámicamente
- **Centros de Costo**: Asignación automática según área del usuario
- **Proveedores**: Manejo opcional de proveedores con cotizaciones
- **Interfaz Glass**: Efectos transparentes y blur para mejor experiencia visual

### 📊 Monitoreo de Solicitudes
- **Dashboard Minimalista**: Métricas clave con diseño limpio
- **Distribución Visual**: Estados de solicitudes con colores intuitivos
- **Actividad Reciente**: Historial de solicitudes con información relevante
- **Estadísticas Rápidas**: Resumen de métricas importantes

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Estilos**: Tailwind CSS 4 con configuración personalizada
- **Efectos**: Glass morphism, backdrop blur, gradientes
- **Herramientas**: ESLint, PostCSS

## 🎯 Usuarios Predefinidos
  
El sistema incluye usuarios predefinidos con sus respectivos datos:

- **Santiago Amaya** - Pirolisis - Jefe de Planta
- **Luisa Ramirez** - Gestión del Ser - Coordinadora Líder
- **Katherin Roldan** - SST - Líder de SST
- **Yesenia Ramirez** - Laboratorio - Auxiliar de Laboratorio
- **Carolina Casas** - Administrativo - Auxiliar Administrativo
- **Juan Manuel** - Administrativo - CMO
- **Pablo Acebedo** - RAAS - CTO

## 📍 Centros de Costo por Área


- **Laboratorio**: Hongos, Bacterias, Análisis
- **Pirolisis**: Mantenimiento, Novedades, Blend
- **Administrativo**: Administración, Mercadeo, Otros Gastos ADM
- **RAAS**: Tecnología, Equipos Tecnológicos
- **Gestión del Ser**: Administración, Mercadeo, Otros Gastos ADM
- **SST**: Administración, Mercadeo, Otros Gastos ADM

## 🏗️ Estructura del Proyecto

```
sirius_financiero/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── layout.tsx         # Layout principal con navbar/footer
│   │   ├── page.tsx           # Landing page minimalista
│   │   ├── solicitudes-compra/ # Formulario de solicitudes
│   │   └── monitoreo-solicitudes/ # Dashboard de monitoreo
│   ├── components/            # Componentes React
│   │   ├── layout/           # Navbar y Footer minimalistas
│   │   ├── ui/               # Componentes UI reutilizables
│   │   ├── LandingPage.tsx   # Página de inicio con fondo
│   │   ├── SolicitudesCompra.tsx # Formulario completo
│   │   └── MonitoreoSolicitudes.tsx # Dashboard con métricas
│   └── lib/                  # Utilidades y configuraciones
├── public/                   # Archivos estáticos
├── tailwind.config.ts        # Configuración personalizada
├── next.config.ts           # Configuración de Next.js
└── package.json             # Dependencias del proyecto
```

## 🚀 Instalación y Uso

1. **Clona el repositorio:**
```bash
git clone https://github.com/14-David-06/sirius_financiero.git
cd sirius_financiero
```

2. **Instala las dependencias:**
```bash
npm install
```

3. **Ejecuta el servidor de desarrollo:**
```bash
npm run dev
```

4. **Abre el proyecto:**
   - Navega a [http://localhost:3000](http://localhost:3000)
   - O [http://localhost:3001](http://localhost:3001) si el puerto 3000 está ocupado

## 📱 Características del Formulario

### Funcionalidades Principales:
- **Selección de Usuario**: Dropdown con usuarios predefinidos
- **Datos Automáticos**: Área y cargo se llenan automáticamente
- **Usuario Personalizado**: Opción "Otro Usuario" para casos especiales
- **Ítems Dinámicos**: Agregar/eliminar ítems con validación
- **Centros de Costo**: Filtrados por área del usuario
- **Proveedor Opcional**: Sección que aparece condicionalmente
- **Validación**: Campos obligatorios con feedback visual

### Efectos Visuales:
- **Glass Morphism**: Fondos transparentes con blur
- **Gradientes**: Colores suaves y transiciones
- **Animaciones**: Transiciones suaves entre estados
- **Responsive**: Adaptado para todos los dispositivos

## 🎨 Personalización Visual

### Colores Principales:
- **Primario**: Azul (#3b82f6) a Púrpura (#a855f7)
- **Secundario**: Cian (#06b6d4) a Azul (#3b82f6)
- **Acentos**: Transparencias y efectos glass

### Efectos Especiales:
- **Backdrop Blur**: Efectos de desenfoque en navegación
- **Glass Morphism**: Fondos translúcidos con bordes suaves
- **Shadows**: Sombras suaves para profundidad
- **Gradients**: Transiciones de color suaves

## 🔧 Scripts Disponibles

```bash
# Desarrollo con Turbopack
npm run dev

# Construcción para producción
npm run build

# Servidor de producción
npm run start

# Linting y validación
npm run lint
```

## 📊 Estado del Proyecto

✅ **Completado:**
- Landing page minimalista
- Formulario de solicitudes completo
- Dashboard de monitoreo
- Diseño responsive
- Usuarios predefinidos
- Centros de costo dinámicos

🔄 **En Desarrollo:**
- Grabación de audio (funcionalidad avanzada)
- Integración con backend
- Validación de archivos
- Notificaciones en tiempo real

## 🌟 Próximas Mejoras

- [ ] Integración con API backend
- [ ] Autenticación de usuarios
- [ ] Almacenamiento de datos persistente
- [ ] Notificaciones push
- [ ] Exportación de reportes
- [ ] Modo oscuro

## 💡 Características Técnicas

- **Performance**: Optimizado con Turbopack
- **Accessibility**: Elementos accesibles y navegación por teclado
- **SEO**: Metadatos optimizados
- **TypeScript**: Tipado estático para mejor desarrollo
- **Modern CSS**: Tailwind CSS con configuración personalizada

---

🎯 **Proyecto desarrollado para optimizar la gestión financiera empresarial con un enfoque minimalista y funcional.**

⚡ **Construido con Next.js 15, React 19, TypeScript y Tailwind CSS**

---
⚖️ AVISO LEGAL Y DERECHOS DE PROPIEDAD INTELECTUAL
📋 INFORMACIÓN GENERAL
Este software y toda la documentación asociada (en adelante, el “Software”) son propiedad exclusiva de Sirius Regenerative Solutions S.A.S ZOMAC (en adelante, la “Empresa”), sociedad legalmente constituida bajo las leyes de la República de Colombia.

🛡️ DERECHOS DE PROPIEDAD INTELECTUAL
TODOS LOS DERECHOS RESERVADOS. El Software comprende, sin limitarse a:

Código fuente y código objeto

Documentación técnica y de usuario

Interfaces gráficas y diseño de experiencia de usuario

Algoritmos, estructuras lógicas y procesos de negocio

Bases de datos y arquitecturas de datos

Marcas, logotipos, elementos gráficos e identidad visual

Todo lo anterior constituye propiedad intelectual protegida por las leyes de derechos de autor, propiedad industrial, secretos empresariales y demás normativas nacionales e internacionales aplicables. Cualquier uso no autorizado está expresamente prohibido.

🚫 RESTRICCIONES DE USO
Queda terminantemente prohibido, sin autorización previa, expresa y por escrito de la Empresa:

Reproducir, distribuir o generar obras derivadas del Software

Realizar ingeniería inversa, descompilar o desensamblar el Software

Vender, sublicenciar, arrendar, ceder o transferir el Software a terceros

Modificar, traducir o adaptar el Software en cualquier forma

Remover o alterar avisos legales, marcas o notas de derechos de autor

Acceder al Software con el propósito de desarrollar productos o servicios competitivos

Utilizar el Software para fines comerciales no autorizados

📄 LICENCIA DE USO RESTRINGIDO
El uso del Software está estrictamente limitado a los siguientes perfiles, bajo condiciones de confidencialidad y seguridad:

Empleados autorizados de Sirius Regenerative Solutions S.A.S ZOMAC

Contratistas o consultores externos con acuerdos de confidencialidad vigentes

Aliados o socios estratégicos, con autorización formal y documentada

Uso interno exclusivo, relacionado con operaciones y desarrollo organizacional

🔒 CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS
El Software puede contener información clasificada y/o datos personales sensibles. En consecuencia, los usuarios autorizados se obligan a:

Mantener la confidencialidad absoluta de toda información a la que accedan

Abstenerse de divulgar información a terceros no autorizados

Adoptar medidas técnicas y organizativas adecuadas para garantizar la seguridad de los datos

Cumplir con la legislación vigente en materia de protección de datos personales

Notificar inmediatamente a la Empresa sobre cualquier incidente de seguridad o acceso indebido

🏛️ JURISDICCIÓN Y LEY APLICABLE
Este Aviso Legal se rige e interpreta conforme a:

La legislación de la República de Colombia, excluyendo normas sobre conflicto de leyes

La jurisdicción exclusiva de los tribunales competentes de Colombia

Normativas relevantes como:

Ley 23 de 1982 (Derecho de Autor)

Decisión Andina 351 de 1993

Otras disposiciones nacionales sobre propiedad intelectual y protección de datos

🌍 PROTECCIÓN INTERNACIONAL
El Software se encuentra protegido por tratados y convenios internacionales, incluyendo pero no limitándose a:

Convenio de Berna sobre obras literarias y artísticas

Convenio de París sobre propiedad industrial

ADPIC (Acuerdo sobre los Aspectos de los Derechos de Propiedad Intelectual relacionados con el Comercio)

Tratado de Cooperación en materia de Patentes (PCT)

Legislación de propiedad intelectual en cada país donde opere la Empresa

🚨 CUMPLIMIENTO NORMATIVO INTERNACIONAL
El desarrollo, uso y operación del Software cumplen con estándares internacionales de privacidad y seguridad, entre ellos:

GDPR – Reglamento General de Protección de Datos (UE)

CCPA – Ley de Privacidad del Consumidor (California, EE. UU.)

LGPD – Ley General de Protección de Datos (Brasil)

SOX – Ley Sarbanes-Oxley (controles financieros y auditoría)

ISO/IEC 27001 – Gestión de Seguridad de la Información

Normativas locales correspondientes en las jurisdicciones donde opera la Empresa

⚠️ EXENCIÓN DE RESPONSABILIDAD
El Software se proporciona “tal como está”, sin ningún tipo de garantía expresa o implícita. La Empresa no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes derivados del uso, mal uso o imposibilidad de uso del Software.

📅 VIGENCIA
El presente Aviso Legal entra en vigor a partir de la fecha de creación del Software y permanecerá vigente hasta su modificación o revocatoria expresa por parte de Sirius Regenerative Solutions S.A.S ZOMAC.

🔄 MODIFICACIONES
La Empresa se reserva el derecho de modificar este Aviso Legal en cualquier momento, sin necesidad de aviso previo. Es responsabilidad del usuario consultar periódicamente los términos vigentes.

© 2025 Sirius Regenerative Solutions S.A.S ZOMAC. Todos los derechos reservados.

Este Software contiene información confidencial y está protegido por la legislación nacional e internacional. El uso no autorizado podrá dar lugar a sanciones civiles, administrativas y/o penales, conforme a las leyes aplicables.


---
