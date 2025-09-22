# 🗄️ Configuración de Bases de Datos D1

Este documento explica cómo están configuradas las bases de datos D1 para desarrollo y producción.

## 📊 **Bases de Datos Disponibles:**

### 🧪 **Desarrollo Local** (`baltc_liga_dev`)
- **ID**: `9126a8ac-b391-45cb-bb46-9505e96e24dc`
- **Datos**: 3 jugadores de prueba
- **Ubicación**: Solo en tu computadora local
- **Uso**: Desarrollo y testing

### 🌐 **Producción** (`baltc-db`)
- **ID**: `ca7ea78d-e491-433c-9f79-fc245235a35a`
- **Datos**: 16 jugadores reales, 35 partidos
- **Ubicación**: Cloudflare (producción)
- **Uso**: Aplicación en vivo

## 🔄 **Cambio de Entornos:**

### Cambiar a Desarrollo:
```bash
npm run env:dev
```
- Configura `wrangler.toml` para desarrollo local
- Usa base de datos `baltc_liga_dev`
- Datos de prueba para desarrollo

### Cambiar a Producción:
```bash
npm run env:prod
```
- Configura `wrangler.toml` para producción
- Usa base de datos `baltc-db`
- Datos reales de la liga

## 🚀 **Comandos por Entorno:**

### Desarrollo Local:
```bash
npm run env:dev          # Cambiar a desarrollo
npm run dev              # Iniciar servidor local
npm run test:curl:local  # Probar APIs locales
```

### Producción:
```bash
npm run env:prod         # Cambiar a producción
npm run deploy           # Desplegar a Cloudflare
npm run test:curl:production  # Probar APIs de producción
```

## 📁 **Archivos de Configuración:**

- **`wrangler.toml`** - Configuración actual (cambia según el entorno)
- **`wrangler.prod.toml`** - Configuración fija para producción
- **`.dev.vars`** - Variables de entorno para desarrollo

## 🗃️ **Gestión de Datos:**

### Ver datos de desarrollo:
```bash
npx wrangler d1 execute baltc_liga_dev --command="SELECT * FROM players"
```

### Ver datos de producción:
```bash
npx wrangler d1 execute baltc-db --command="SELECT * FROM players" --remote
```

### Agregar datos de prueba:
```bash
npm run env:dev
npx wrangler d1 execute baltc_liga_dev --command="INSERT INTO players (name) VALUES ('Nuevo Jugador')"
```

## ⚠️ **Importante:**

1. **Desarrollo**: Los datos son locales y se pierden al reiniciar
2. **Producción**: Los datos son persistentes en Cloudflare
3. **Cambio de entorno**: Siempre usar `npm run env:dev` o `npm run env:prod`
4. **Deploy**: Solo funciona con configuración de producción

## 🎯 **Flujo de Trabajo Recomendado:**

1. **Desarrollo**: `npm run env:dev` → `npm run dev`
2. **Testing**: `npm run test:curl:local`
3. **Deploy**: `npm run env:prod` → `npm run deploy`
4. **Verificación**: `npm run test:curl:production`

## 📊 **Estado Actual:**

- **✅ Desarrollo**: Configurado con datos de prueba
- **✅ Producción**: Configurado con datos reales
- **✅ Scripts**: Automatizados para cambio de entorno
- **✅ Testing**: Separado por entorno
