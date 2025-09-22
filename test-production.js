#!/usr/bin/env node

/**
 * Tests de Producción para GarçaBot
 * Valida que el bot funciona correctamente en producción
 */

import https from 'https';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// URL de producción (cambiar por la URL real cuando esté desplegado)
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://baltc-liga.pages.dev';

async function makeProductionRequest(message, player = 'test_user') {
  const url = new URL(`${PRODUCTION_URL}/api/bot`);
  
  const postData = JSON.stringify({
    message,
    player,
    system: 'C'
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.write(postData);
    req.end();
  });
}

async function runProductionTests() {
  console.log(`${colors.bold}${colors.blue}🌐 PRODUCTION TESTS - GarçaBot${colors.reset}`);
  console.log(`${colors.blue}Testing production at: ${PRODUCTION_URL}${colors.reset}\n`);
  
  let passed = 0;
  let total = 0;

  function test(name, testFn) {
    total++;
    try {
      const result = testFn();
      if (result.success) {
        console.log(`${colors.green}✅ ${name}${colors.reset}`);
        passed++;
      } else {
        console.log(`${colors.red}❌ ${name}: ${result.message}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}💥 ${name}: ${error.message}${colors.reset}`);
    }
  }

  // Test 1: Disponibilidad del bot
  test("Bot está disponible", async () => {
    const response = await makeProductionRequest("hola", "test_availability");
    
    return {
      success: response && response.reply,
      message: response ? "OK" : "Bot not responding"
    };
  });

  // Test 2: Workers AI en producción
  test("Workers AI en producción", async () => {
    const response = await makeProductionRequest("primero", "test_prod_ai");
    
    return {
      success: response.aiPowered === true,
      message: response.aiPowered ? "OK" : "Workers AI not working in production"
    };
  });

  // Test 3: Memoria KV en producción
  test("Memoria KV en producción", async () => {
    const response = await makeProductionRequest("hola", "test_prod_kv");
    
    return {
      success: response.hasMemory === true,
      message: response.hasMemory ? "OK" : "KV memory not working in production"
    };
  });

  // Test 4: Datos de D1 en producción
  test("Base de datos D1 en producción", async () => {
    const response = await makeProductionRequest("¿quién está primero?", "test_prod_db");
    
    return {
      success: response.hasLeagueData === true && response.reply.includes("Jugador"),
      message: response.hasLeagueData ? "OK" : "D1 database not accessible in production"
    };
  });

  // Test 5: Funcionalidad completa
  test("Funcionalidad completa end-to-end", async () => {
    // Identificarse
    await makeProductionRequest("Me llamo Jugador Dev 1", "test_e2e");
    
    // Hacer pregunta personalizada
    const response = await makeProductionRequest("¿cuántos partidos me faltan?", "test_e2e");
    
    return {
      success: response.reply.includes("Jugador Dev 1"),
      message: response.reply.includes("Jugador Dev 1") ? "OK" : "End-to-end functionality broken"
    };
  });

  // Resultados
  console.log(`\n${colors.bold}📊 PRODUCTION RESULTS: ${passed}/${total} passed${colors.reset}`);
  
  if (passed === total) {
    console.log(`${colors.green}${colors.bold}🚀 PRODUCTION IS HEALTHY!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}⚠️  PRODUCTION ISSUES DETECTED${colors.reset}`);
    process.exit(1);
  }
}

runProductionTests().catch(error => {
  console.error(`${colors.red}💥 Production test error: ${error.message}${colors.reset}`);
  process.exit(1);
});
