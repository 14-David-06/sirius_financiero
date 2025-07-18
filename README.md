# Sirius Financiero

Plataforma integral para la gestión financiera empresarial con interfaz minimalista y moderna, enfocada en la optimización de procesos de compra y monitoreo de solicitudes.

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
