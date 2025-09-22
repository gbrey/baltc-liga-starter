#!/bin/bash

# Script para cambiar entre entornos de desarrollo y producción

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENV=${1:-dev}

if [ "$ENV" = "prod" ]; then
    echo -e "${BLUE}🔄 Cambiando a entorno de PRODUCCIÓN...${NC}"
    cp wrangler.prod.toml wrangler.toml
    echo -e "${GREEN}✅ Configurado para producción${NC}"
    echo -e "${YELLOW}📊 Base de datos: baltc-db (16 jugadores, 35 partidos)${NC}"
    echo -e "${YELLOW}🌐 URL: https://baltc-liga-starter.pages.dev${NC}"
elif [ "$ENV" = "dev" ]; then
    echo -e "${BLUE}🔄 Cambiando a entorno de DESARROLLO...${NC}"
    # Restaurar configuración de desarrollo
    cat > wrangler.toml << EOF
# wrangler.toml para Cloudflare Pages - DESARROLLO
name = "baltc-liga"
compatibility_date = "2025-01-20"
pages_build_output_dir = "./public"

# Base de datos para desarrollo local
[[d1_databases]]
binding = "DB"
database_name = "baltc_liga_dev"
database_id = "9126a8ac-b391-45cb-bb46-9505e96e24dc"
EOF
    echo -e "${GREEN}✅ Configurado para desarrollo${NC}"
    echo -e "${YELLOW}📊 Base de datos: baltc_liga_dev (3 jugadores de prueba)${NC}"
    echo -e "${YELLOW}🌐 URL: http://localhost:8787${NC}"
else
    echo -e "${YELLOW}❓ Uso: $0 [dev|prod]${NC}"
    echo -e "${BLUE}Entornos disponibles:${NC}"
    echo -e "  dev  - Desarrollo local (baltc_liga_dev)"
    echo -e "  prod - Producción (baltc-db)"
    exit 1
fi

echo ""
echo -e "${BLUE}💡 Comandos útiles:${NC}"
echo -e "  npm run dev          - Iniciar servidor de desarrollo"
echo -e "  npm run deploy       - Desplegar a producción"
echo -e "  npm run test:curl:local     - Probar APIs locales"
echo -e "  npm run test:curl:production - Probar APIs de producción"
