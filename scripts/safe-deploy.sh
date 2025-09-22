#!/bin/bash

# 🚀 Script de Deploy Seguro para Producción
# Previene errores de configuración entre entornos

set -e  # Salir si hay cualquier error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}🚀 DEPLOY SEGURO A PRODUCCIÓN - BALTC Liga${NC}"
echo "=================================================="

# Paso 1: Verificar que estamos en el directorio correcto
if [ ! -f "wrangler.toml" ] || [ ! -f "wrangler.prod.toml" ]; then
    echo -e "${RED}❌ Error: No se encontraron archivos de configuración${NC}"
    echo -e "${RED}   Asegúrate de estar en el directorio del proyecto${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directorio correcto detectado${NC}"

# Paso 2: Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Hay cambios sin commitear${NC}"
    echo -e "${YELLOW}   Archivos modificados:${NC}"
    git status --porcelain | sed 's/^/   /'
    echo ""
    read -p "¿Deseas continuar de todos modos? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Deploy cancelado${NC}"
        exit 1
    fi
fi

# Paso 3: Ejecutar validación previa
echo -e "${BLUE}🔍 Ejecutando validación previa...${NC}"
if npm run validate:prod; then
    echo -e "${GREEN}✅ Validación exitosa${NC}"
else
    echo -e "${RED}❌ Validación falló. Deploy cancelado${NC}"
    exit 1
fi

# Paso 4: Backup de configuración actual
echo -e "${BLUE}💾 Creando backup de configuración...${NC}"
cp wrangler.toml wrangler.toml.backup.$(date +%Y%m%d_%H%M%S)

# Paso 5: Cambiar a configuración de producción
echo -e "${BLUE}🔄 Cambiando a configuración de producción...${NC}"
cp wrangler.prod.toml wrangler.toml

# Paso 6: Deploy a producción
echo -e "${BLUE}🚀 Ejecutando deploy a producción...${NC}"
if npx wrangler pages deploy ./public --project-name=baltc-liga-starter; then
    echo -e "${GREEN}✅ Deploy exitoso${NC}"
else
    echo -e "${RED}❌ Deploy falló${NC}"
    # Restaurar configuración en caso de error
    mv wrangler.toml.backup.$(date +%Y%m%d_%H%M%S) wrangler.toml 2>/dev/null || true
    exit 1
fi

# Paso 7: Restaurar configuración de desarrollo
echo -e "${BLUE}🔄 Restaurando configuración de desarrollo...${NC}"
cp wrangler.prod.toml wrangler.toml.backup.prod.$(date +%Y%m%d_%H%M%S)
mv wrangler.toml.backup.$(date +%Y%m%d_%H%M%S) wrangler.toml 2>/dev/null || true

# Paso 8: Verificar que producción funciona
echo -e "${BLUE}🧪 Verificando que producción funciona...${NC}"
if node scripts/verify-production.js; then
    echo -e "${GREEN}✅ Verificación exitosa${NC}"
else
    echo -e "${YELLOW}⚠️  Algunas verificaciones fallaron, pero el deploy se completó${NC}"
fi

# Paso 9: Limpiar archivos de backup temporales
echo -e "${BLUE}🧹 Limpiando archivos temporales...${NC}"
rm -f wrangler.toml.backup.* 2>/dev/null || true

echo ""
echo -e "${BOLD}${GREEN}🎉 ¡DEPLOY COMPLETADO EXITOSAMENTE!${NC}"
echo -e "${GREEN}   Producción: https://baltc-liga-starter.pages.dev${NC}"
echo -e "${GREEN}   Admin: https://baltc-liga-starter.pages.dev/admin${NC}"
echo ""
echo -e "${BLUE}📋 Próximos pasos recomendados:${NC}"
echo -e "${BLUE}   1. Verificar el dashboard de administración${NC}"
echo -e "${BLUE}   2. Probar el bot con algunas preguntas${NC}"
echo -e "${BLUE}   3. Confirmar que todos los datos están presentes${NC}"
