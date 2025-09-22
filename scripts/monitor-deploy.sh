#!/bin/bash

# Script para monitorear el despliegue en Cloudflare
echo "🚀 Monitoreando despliegue en Cloudflare Pages..."

# Verificar si estamos autenticados
echo "📋 Verificando autenticación..."
npx wrangler whoami

# Verificar el estado del proyecto
echo "📊 Estado del proyecto:"
npx wrangler pages project list

# Verificar deployments recientes
echo "📈 Deployments recientes:"
npx wrangler pages deployment list --project-name=baltc-liga-starter

# Verificar logs en tiempo real (opcional)
echo "📝 Para ver logs en tiempo real, ejecuta:"
echo "npx wrangler pages deployment tail --project-name=baltc-liga-starter"

echo "✅ Monitoreo completado!"
