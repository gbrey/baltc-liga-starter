#!/bin/bash

# Script para desplegar y probar automáticamente
echo "🚀 Desplegando y probando BALTC Liga..."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "wrangler.toml" ]; then
    print_error "No se encontró wrangler.toml. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

# 1. Verificar autenticación
print_status "Verificando autenticación con Cloudflare..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    print_error "No estás autenticado con Cloudflare. Ejecuta 'npx wrangler login' primero."
    exit 1
fi
print_success "Autenticación verificada"

# 2. Hacer deploy
print_status "Desplegando a Cloudflare Pages..."
if npx wrangler pages deploy ./public --project-name=baltc-liga-starter; then
    print_success "Deploy completado exitosamente"
else
    print_error "El deploy falló"
    exit 1
fi

# 3. Esperar un momento para que el deploy se propague
print_status "Esperando 30 segundos para que el deploy se propague..."
sleep 30

# 4. Ejecutar tests locales primero
print_status "Ejecutando tests locales..."
if node scripts/test-apis.js local; then
    print_success "Tests locales pasaron"
else
    print_warning "Algunos tests locales fallaron, pero continuando..."
fi

# 5. Ejecutar tests de producción
print_status "Ejecutando tests de producción..."
if node scripts/test-apis.js production; then
    print_success "Tests de producción pasaron"
else
    print_error "Tests de producción fallaron"
    exit 1
fi

# 6. Verificar deployment
print_status "Verificando deployment..."
npx wrangler pages deployment list --project-name=baltc-liga-starter

print_success "🎉 Despliegue y testing completados exitosamente!"
print_status "Tu aplicación está disponible en: https://baltc-liga-starter.pages.dev"
