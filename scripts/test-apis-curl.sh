#!/bin/bash

# Script para probar las APIs usando curl (más confiable para HTTPS)
echo "🧪 Probando APIs con curl..."

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
ENVIRONMENT=${1:-local}
if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://baltc-liga-starter.pages.dev"
else
    BASE_URL="http://localhost:8787"
fi

echo -e "${BLUE}🌐 Probando: $ENVIRONMENT ($BASE_URL)${NC}\n"

# Función para probar un endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="$3"
    local data="$4"
    local expected_status="$5"
    
    echo -n "⏳ $name... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK (${http_code})${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL (${http_code})${NC}"
        return 1
    fi
}

# Ejecutar tests
passed=0
total=0

# Test 1: Health Check - Ping
total=$((total + 1))
if test_endpoint "Health Check - Ping" "/api/ping" "GET" "" "200"; then
    passed=$((passed + 1))
fi

# Test 2: Bot Health Check
total=$((total + 1))
if test_endpoint "Bot Health Check" "/api/bot/health" "GET" "" "200"; then
    passed=$((passed + 1))
fi

# Test 3: Bot API - Mensaje de prueba "primero"
total=$((total + 1))
if test_endpoint "Bot API - Mensaje 'primero'" "/api/bot" "POST" '{"message":"primero","player":"test_user","system":"A"}' "200"; then
    passed=$((passed + 1))
fi

# Test 4: Bot API - Mensaje de prueba "cago"
total=$((total + 1))
if test_endpoint "Bot API - Mensaje 'cago'" "/api/bot" "POST" '{"message":"cago","player":"test_user","system":"A"}' "200"; then
    passed=$((passed + 1))
fi

# Test 5: Bot API - Mensaje aleatorio
total=$((total + 1))
if test_endpoint "Bot API - Mensaje aleatorio" "/api/bot" "POST" '{"message":"hola bot","player":"test_user","system":"A"}' "200"; then
    passed=$((passed + 1))
fi

# Test 6: Standings API
total=$((total + 1))
if test_endpoint "Standings API" "/api/standings" "GET" "" "200"; then
    passed=$((passed + 1))
fi

# Resumen
echo ""
echo -e "${BLUE}📊 Resumen:${NC}"
echo -e "${GREEN}✅ Pasaron: $passed/$total${NC}"
echo -e "${RED}❌ Fallaron: $((total - passed))/$total${NC}"

# Exit code basado en resultados
if [ $passed -eq $total ]; then
    exit 0
else
    exit 1
fi
