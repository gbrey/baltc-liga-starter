# 🚀 Monitoreo y Testing de BALTC Liga

Este documento explica cómo monitorear el despliegue en Cloudflare Pages y ejecutar tests a las APIs.

## 📋 Prerequisitos

1. **Autenticación con Cloudflare**:
   ```bash
   npx wrangler login
   ```

2. **Verificar autenticación**:
   ```bash
   npx wrangler whoami
   ```

## 🔍 Comandos de Monitoreo

### 1. Monitoreo General
```bash
npm run monitor
```
- Verifica autenticación
- Lista proyectos de Pages
- Muestra deployments recientes
- Proporciona comandos para logs

### 2. Ver Logs en Tiempo Real
```bash
npm run logs
```
- Monitorea logs de Cloudflare Pages en tiempo real
- Útil para debugging de requests en vivo

### 3. Deploy y Test Automático
```bash
npm run deploy-and-test
```
- Hace deploy a Cloudflare Pages
- Ejecuta tests locales y de producción
- Verifica que todo funcione correctamente

## 🧪 Comandos de Testing

### Tests Locales
```bash
# Con Node.js (puede tener problemas con SSL)
npm run test:local

# Con curl (más confiable)
npm run test:curl:local
```

### Tests de Producción
```bash
# Con Node.js (puede tener problemas con SSL)
npm run test:production

# Con curl (recomendado)
npm run test:curl:production
```

### Todos los Tests
```bash
npm run test:all
```

## 📊 APIs que se Testean

1. **Health Check - Ping** (`/api/ping`)
   - Verifica que el servidor esté funcionando

2. **Bot Health Check** (`/api/bot/health`)
   - Verifica que el bot esté funcionando

3. **Bot API - Mensaje "primero"** (`/api/bot`)
   - Prueba detección específica de mensaje

4. **Bot API - Mensaje "cago"** (`/api/bot`)
   - Prueba detección específica de mensaje

5. **Bot API - Mensaje aleatorio** (`/api/bot`)
   - Prueba respuestas humorísticas

6. **Standings API** (`/api/standings`)
   - Verifica acceso a datos de la liga

## 🌐 URLs Importantes

- **Producción**: https://baltc-liga-starter.pages.dev
- **Dashboard Cloudflare**: https://dash.cloudflare.com
- **Proyecto Pages**: https://dash.cloudflare.com/pages

## 🔧 Comandos Útiles de Wrangler

### Información del Proyecto
```bash
npx wrangler pages project list
```

### Deployments Recientes
```bash
npx wrangler pages deployment list --project-name=baltc-liga-starter
```

### Logs de Deployment Específico
```bash
npx wrangler pages deployment tail --project-name=baltc-liga-starter
```

### Deploy Manual
```bash
npm run deploy
```

### Base de Datos
```bash
# Listar bases de datos
npx wrangler d1 list

# Ejecutar SQL
npx wrangler d1 execute baltc_liga_prod --command="SELECT * FROM players"
```

## 🚨 Troubleshooting

### Problema: "Project not found"
- Verificar que el nombre del proyecto sea correcto: `baltc-liga-starter`

### Problema: "Invalid database UUID"
- La base de datos debe existir en Cloudflare
- Verificar que el `database_id` en `wrangler.toml` sea correcto

### Problema: Tests fallan con SSL
- Usar `npm run test:curl:production` en lugar de `npm run test:production`

### Problema: Deploy falla
- Verificar que no haya cambios sin commitear
- Usar `--commit-dirty=true` si es necesario

## 📈 Monitoreo Continuo

Para monitoreo continuo, puedes usar:

1. **Scripts automatizados** en CI/CD
2. **Alertas de Cloudflare** para errores
3. **Logs de Cloudflare Pages** para debugging
4. **Tests regulares** con los scripts proporcionados

## 🎯 Estado Actual

✅ **Deploy exitoso**: https://baltc-liga-starter.pages.dev  
✅ **APIs funcionando**: 6/6 tests pasan  
✅ **Base de datos conectada**: `hasLeagueData: true`  
✅ **Bot integrado**: Frontend conectado con backend  
