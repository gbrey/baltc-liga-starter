#!/bin/bash

# Script para monitorear logs en tiempo real
echo "📝 Monitoreando logs de Cloudflare Pages..."

# Verificar que estamos autenticados
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ No estás autenticado con Cloudflare. Ejecuta 'npx wrangler login' primero."
    exit 1
fi

echo "🔍 Monitoreando logs en tiempo real..."
echo "💡 Presiona Ctrl+C para salir"
echo ""

# Monitorear logs en tiempo real
npx wrangler pages deployment tail --project-name=baltc-liga-starter
