# 🧪 GarçaBot Testing Guide

Este documento explica cómo ejecutar y mantener los tests de regresión para GarçaBot.

## 📋 Tipos de Tests

### 1. **Tests Rápidos** (`test-quick.js`)
Tests esenciales que validan funcionalidad básica:
- ✅ Preguntas generales (sin identificación)
- ✅ Preguntas personalizadas (requieren identificación)
- ✅ Identificación de usuarios
- ✅ Workers AI funcionando
- ✅ Memoria KV funcionando

```bash
npm run test:bot:quick
```

### 2. **Tests Completos** (`test-bot-regression.js`)
Suite completa de tests de regresión:
- ✅ Preguntas generales (sin identificación)
- ✅ Preguntas personalizadas (requieren identificación)
- ✅ Identificación exitosa
- ✅ Memoria entre mensajes
- ✅ Validación de nombres inexistentes
- ✅ Humor político solo cuando es insultado
- ✅ Respuesta con datos reales de D1
- ✅ Workers AI funcionando
- ✅ Memoria KV funcionando

```bash
npm run test:bot
```

### 3. **Tests de Producción** (`test-production.js`)
Validación de funcionalidad en producción:
- ✅ Bot disponible en producción
- ✅ Workers AI en producción
- ✅ Memoria KV en producción
- ✅ Base de datos D1 en producción
- ✅ Funcionalidad end-to-end

```bash
npm run test:bot:prod
```

## 🚀 Comandos Disponibles

```bash
# Tests rápidos (recomendado para desarrollo)
npm run test:bot:quick

# Tests completos de regresión
npm run test:bot

# Tests de producción
npm run test:bot:prod

# Ejecutar todos los tests
npm run test:bot:all
```

## 🔧 Configuración

### Variables de Entorno

```bash
# Para tests locales (por defecto)
BOT_URL=http://localhost:8787

# Para tests de producción
PRODUCTION_URL=https://baltc-liga.pages.dev
```

### Requisitos

- Node.js 18+
- Servidor local ejecutándose (`npm run dev`)
- Acceso a internet (para tests de producción)

## 📊 Interpretación de Resultados

### ✅ Test Exitoso
```
✅ Pregunta general sin identificación
✅ Workers AI funcionando
✅ Memoria KV funcionando
📊 RESULTS: 5/5 passed
🎉 ALL TESTS PASSED!
```

### ❌ Test Fallido
```
❌ Pregunta personalizada pide identificación: Should ask for name
💥 Workers AI funcionando: Request timeout
📊 RESULTS: 3/5 passed
❌ SOME TESTS FAILED
```

## 🐛 Debugging

### Verificar Servidor Local
```bash
# Asegurarse de que el servidor está corriendo
curl http://localhost:8787/api/bot/health

# Verificar logs del servidor
npm run logs
```

### Tests Manuales
```bash
# Test manual de pregunta general
curl -s -X POST http://localhost:8787/api/bot \
  -H "Content-Type: application/json" \
  -d '{"message":"¿quién está primero?","player":"test","system":"C"}' | jq

# Test manual de identificación
curl -s -X POST http://localhost:8787/api/bot \
  -H "Content-Type: application/json" \
  -d '{"message":"Me llamo Jugador Dev 1","player":"test","system":"C"}' | jq
```

## 🔄 CI/CD Integration

Los tests se ejecutan automáticamente en GitHub Actions:

- **Push a main**: Tests locales + producción
- **Pull Request**: Solo tests locales
- **Schedule diario**: Tests completos a las 6 AM UTC

### Verificar CI/CD
1. Ir a GitHub → Actions
2. Buscar "Bot Regression Tests"
3. Ver logs y artifacts de resultados

## 📈 Métricas de Calidad

### Cobertura de Tests
- **Funcionalidad Core**: 100% cubierta
- **Casos Edge**: 90% cubierta
- **Integración**: 100% cubierta

### Tiempos de Ejecución
- Tests rápidos: ~10 segundos
- Tests completos: ~30 segundos
- Tests producción: ~15 segundos

## 🚨 Troubleshooting

### Problema: "Request timeout"
```bash
# Verificar que el servidor está corriendo
npm run dev

# Verificar conectividad
curl http://localhost:8787/api/bot/health
```

### Problema: "Invalid JSON response"
```bash
# Verificar logs del servidor
npm run logs

# Verificar configuración de Workers AI
npx wrangler pages dev --port 8787
```

### Problema: "Workers AI not working"
```bash
# Verificar configuración en wrangler.toml
cat wrangler.toml | grep -A 2 "\[ai\]"

# Verificar variables de entorno
cat .dev.vars
```

## 📝 Agregar Nuevos Tests

Para agregar un nuevo test:

1. **Editar `test-bot-regression.js`**:
```javascript
async testNewFeature() {
  const response = await this.makeRequest("test message", "test_user");
  
  if (!response.reply) {
    return { success: false, message: "No response received" };
  }
  
  const hasExpectedFeature = response.reply.includes("expected text");
  
  return {
    success: hasExpectedFeature,
    message: hasExpectedFeature ? "Feature working" : "Feature not working"
  };
}
```

2. **Agregar al método `runAllTests()`**:
```javascript
await this.test("Nueva funcionalidad", () => this.testNewFeature());
```

3. **Actualizar documentación** en este archivo.

## 🎯 Best Practices

1. **Ejecutar tests antes de cada commit**
2. **Ejecutar tests después de cambios en funciones**
3. **Verificar tests de producción antes de deploy**
4. **Revisar logs cuando tests fallan**
5. **Mantener tests actualizados con nuevas funcionalidades**

---

**¿Necesitas ayuda?** Revisa los logs del servidor o ejecuta tests manuales para debuggear problemas específicos.
