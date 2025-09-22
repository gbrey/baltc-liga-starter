# 🚀 Guía de Deploy - BALTC Liga

## 📋 Configuración de Entornos

### 🏠 Desarrollo Local
- **Archivo:** `wrangler.toml`
- **Base de datos:** `baltc_liga_dev` (ID: 9126a8ac-b391-45cb-bb46-9505e96e24dc)
- **KV:** `d6bdd7cff5564a88b218301bdc4af27f`
- **Comando:** `npm run dev`

### 🌐 Producción
- **Archivo:** `wrangler.prod.toml`
- **Base de datos:** `baltc-db` (ID: ca7ea78d-e491-433c-9f79-fc245235a35a)
- **KV:** `d6bdd7cff5564a88b218301bdc4af27f`
- **Comando:** `npm run deploy:prod`

## ⚠️ IMPORTANTE: Separación de Entornos

**NUNCA hacer deploy con `wrangler.toml` a producción**
**SIEMPRE usar `wrangler.prod.toml` para producción**

## 🔧 Comandos de Deploy

### Desarrollo Local
```bash
npm run dev
```

### Producción
```bash
npm run deploy:prod
```

### Verificación Post-Deploy
```bash
npm run test:prod
```

## 🚨 Checklist de Deploy

- [ ] Verificar que `wrangler.toml` apunta a desarrollo
- [ ] Verificar que `wrangler.prod.toml` apunta a producción
- [ ] Ejecutar tests locales antes del deploy
- [ ] Usar comando correcto para producción
- [ ] Verificar datos en producción después del deploy
- [ ] Confirmar que el dashboard funciona

## 📊 URLs Importantes

- **Local:** http://localhost:8787
- **Admin Local:** http://localhost:8787/admin
- **Producción:** https://baltc-liga-starter.pages.dev
- **Admin Producción:** https://baltc-liga-starter.pages.dev/admin

## 🔐 Credenciales

- **Usuario:** admin
- **Contraseña:** CategoriaC
