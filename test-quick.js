#!/usr/bin/env node

/**
 * Tests Rápidos para GarçaBot
 * Ejecuta los tests más importantes para validar funcionalidad básica
 */

import { execSync } from 'child_process';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function makeRequest(message, player = 'test_user') {
  try {
    const result = execSync(`curl -s -X POST http://localhost:8787/api/bot \
      -H "Content-Type: application/json" \
      -d '{"message":"${message}","player":"${player}","system":"C"}'`, 
      { encoding: 'utf8', timeout: 5000 });
    
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function runQuickTests() {
  console.log(`${colors.bold}${colors.blue}⚡ QUICK TESTS - GarçaBot${colors.reset}\n`);
  
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

  // Test 1: Pregunta general
  test("Pregunta general sin identificación", () => {
    const response = makeRequest("¿quién está primero?", "test_general");
    const asksForName = response.reply.toLowerCase().includes("nombre") || 
                       response.reply.toLowerCase().includes("llamas");
    const isDirectResponse = !asksForName;
    
    return {
      success: isDirectResponse,
      message: isDirectResponse ? "OK" : "Should respond directly without asking for name"
    };
  });

  // Test 2: Pregunta personalizada
  test("Pregunta personalizada pide identificación", () => {
    const response = makeRequest("¿cuántos partidos tengo?", "test_personal");
    const asksForName = response.reply.toLowerCase().includes("nombre") || 
                       response.reply.toLowerCase().includes("llamas");
    
    return {
      success: asksForName,
      message: asksForName ? "OK" : "Should ask for name"
    };
  });

  // Test 3: Identificación
  test("Identificación exitosa", () => {
    const response = makeRequest("Me llamo Jugador Dev 1", "test_identify");
    const recognizesName = response.reply.includes("Jugador Dev 1");
    
    return {
      success: recognizesName,
      message: recognizesName ? "OK" : "Should recognize the name"
    };
  });

  // Test 4: Workers AI
  test("Workers AI funcionando", () => {
    const response = makeRequest("primero", "test_ai");
    const hasTestMessage = response.reply.includes("TEST EXITOSO");
    
    return {
      success: hasTestMessage && response.aiPowered,
      message: hasTestMessage ? "OK" : "Workers AI not responding"
    };
  });

  // Test 5: Memoria KV
  test("Memoria KV funcionando", () => {
    const response = makeRequest("hola", "test_kv");
    
    return {
      success: response.hasMemory === true && response.playerProfile,
      message: response.hasMemory ? "OK" : "KV memory not working"
    };
  });

  // Resultados
  console.log(`\n${colors.bold}📊 RESULTS: ${passed}/${total} passed${colors.reset}`);
  
  if (passed === total) {
    console.log(`${colors.green}${colors.bold}🎉 ALL TESTS PASSED!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}❌ SOME TESTS FAILED${colors.reset}`);
    process.exit(1);
  }
}

runQuickTests().catch(error => {
  console.error(`${colors.red}💥 Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
