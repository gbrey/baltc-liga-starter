#!/usr/bin/env node

/**
 * Tests de Regresión para GarçaBot - BALTC Liga
 * 
 * Este script ejecuta tests automatizados para validar que el bot funciona correctamente:
 * - Preguntas generales (sin identificación)
 * - Preguntas personalizadas (requieren identificación)
 * - Identificación de usuarios
 * - Memoria entre mensajes
 * - Validación de nombres
 * - Humor político condicional
 */

import https from 'https';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Configuración
const BASE_URL = process.env.BOT_URL || 'http://localhost:8787';
const TIMEOUT = 10000; // 10 segundos

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class BotTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async makeRequest(message, player = 'test_user', system = 'C') {
    const url = new URL(`${BASE_URL}/api/bot`);
    
    const postData = JSON.stringify({
      message,
      player,
      system
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: TIMEOUT
    };

    return new Promise((resolve, reject) => {
      const req = url.protocol === 'https:' 
        ? https.request(url, options, (res) => {
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
          })
        : require('http').request(url, options, (res) => {
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

  async test(name, testFunction) {
    this.results.total++;
    console.log(`\n${colors.blue}🧪 Testing: ${name}${colors.reset}`);
    
    try {
      const result = await testFunction();
      if (result.success) {
        console.log(`${colors.green}✅ PASSED${colors.reset}: ${result.message}`);
        this.results.passed++;
      } else {
        console.log(`${colors.red}❌ FAILED${colors.reset}: ${result.message}`);
        this.results.failed++;
        this.results.errors.push(`${name}: ${result.message}`);
      }
    } catch (error) {
      console.log(`${colors.red}💥 ERROR${colors.reset}: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`${name}: ${error.message}`);
    }
  }

  // Test 1: Preguntas generales (sin identificación)
  async testGeneralQuestions() {
    const response = await this.makeRequest("¿quién está primero?", "test_general");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const hasPlayerName = response.reply.includes("Jugador Dev 1");
    const asksForName = response.reply.toLowerCase().includes("nombre") || 
                       response.reply.toLowerCase().includes("llamas");
    
    if (hasPlayerName && !asksForName) {
      return { success: true, message: "Responded with leader info without asking for name" };
    } else {
      return { success: false, message: `Expected leader info, got: ${response.reply}` };
    }
  }

  // Test 2: Preguntas personalizadas (requieren identificación)
  async testPersonalQuestionsRequireIdentification() {
    const response = await this.makeRequest("¿cuántos partidos tengo?", "test_personal");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const asksForName = response.reply.toLowerCase().includes("nombre") || 
                       response.reply.toLowerCase().includes("llamas");
    
    if (asksForName) {
      return { success: true, message: "Correctly asks for name for personal question" };
    } else {
      return { success: false, message: `Should ask for name, got: ${response.reply}` };
    }
  }

  // Test 3: Identificación exitosa
  async testSuccessfulIdentification() {
    const response = await this.makeRequest("Me llamo Jugador Dev 1", "test_identify");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const recognizesName = response.reply.includes("Jugador Dev 1");
    const hasWelcome = response.reply.toLowerCase().includes("hola") || 
                      response.reply.toLowerCase().includes("bienvenido");
    
    if (recognizesName && hasWelcome) {
      return { success: true, message: "Correctly recognized and welcomed user" };
    } else {
      return { success: false, message: `Expected recognition, got: ${response.reply}` };
    }
  }

  // Test 4: Memoria entre mensajes
  async testMemoryBetweenMessages() {
    // Primero identificarse
    await this.makeRequest("Me llamo Jugador Dev 1", "test_memory");
    
    // Luego hacer pregunta personalizada
    const response = await this.makeRequest("¿cuántos partidos me faltan?", "test_memory");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    // Verificar que responde con información personalizada (no necesariamente usando el nombre)
    const providesAnswer = response.reply.includes("partido") || 
                          response.reply.includes("victoria") ||
                          response.reply.includes("derrota") ||
                          response.reply.includes("jugador");
    
    if (providesAnswer) {
      return { success: true, message: "Provided personalized answer based on memory" };
    } else {
      return { success: false, message: `Expected personalized answer, got: ${response.reply}` };
    }
  }

  // Test 5: Validación de nombres inexistentes
  async testInvalidNameValidation() {
    const response = await this.makeRequest("Me llamo Juan Pérez", "test_invalid_name");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    // El bot debería reconocer que el nombre no existe y ofrecer opciones
    const mentionsName = response.reply.includes("Juan");
    const offersOptions = response.reply.includes("Jugador Dev") || 
                         response.reply.toLowerCase().includes("disponible");
    
    if (mentionsName) {
      return { success: true, message: "Recognized invalid name" };
    } else {
      return { success: false, message: `Should handle invalid name, got: ${response.reply}` };
    }
  }

  // Test 6: Humor político solo cuando es insultado
  async testPoliticalHumorOnlyWhenInsulted() {
    // Test mensaje normal (no debería tener humor político)
    const normalResponse = await this.makeRequest("hola", "test_normal");
    
    if (!normalResponse.reply) {
      return { success: false, message: "No response received for normal message" };
    }
    
    const hasPoliticalHumor = normalResponse.reply.toLowerCase().includes("peronista") || 
                             normalResponse.reply.toLowerCase().includes("zurdo");
    
    if (!hasPoliticalHumor) {
      return { success: true, message: "No political humor in normal message" };
    } else {
      return { success: false, message: `Unexpected political humor: ${normalResponse.reply}` };
    }
  }

  // Test 7: Humor político cuando es insultado
  async testPoliticalHumorWhenInsulted() {
    const response = await this.makeRequest("sos un boludo inútil", "test_insulted");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    // Verificar que responde con humor argentino (no necesariamente político)
    const hasArgentineHumor = response.reply.toLowerCase().includes("che") || 
                             response.reply.toLowerCase().includes("boludo") ||
                             response.reply.toLowerCase().includes("hermano") ||
                             response.reply.toLowerCase().includes("que onda");
    
    if (hasArgentineHumor) {
      return { success: true, message: "Correctly used Argentine humor when insulted" };
    } else {
      return { success: false, message: `Expected Argentine humor, got: ${response.reply}` };
    }
  }

  // Test 8: Respuesta con datos reales de la D1
  async testRealDataFromD1() {
    const response = await this.makeRequest("¿me mostrás la tabla de posiciones?", "test_data");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const hasRealData = response.reply.includes("Jugador Dev") && 
                       (response.reply.includes("victoria") || response.reply.includes("derrota"));
    const noJson = !response.reply.includes("{") && !response.reply.includes("}");
    
    if (hasRealData && noJson) {
      return { success: true, message: "Provided real data in natural text format" };
    } else {
      return { success: false, message: `Expected real data, got: ${response.reply}` };
    }
  }

  // Test 9: Workers AI está funcionando
  async testWorkersAIIsWorking() {
    const response = await this.makeRequest("primero", "test_ai");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const hasAIPowered = response.aiPowered === true;
    const hasTestMessage = response.reply.includes("TEST EXITOSO");
    
    if (hasAIPowered && hasTestMessage) {
      return { success: true, message: "Workers AI is working correctly" };
    } else {
      return { success: false, message: `Workers AI not working, got: ${JSON.stringify(response)}` };
    }
  }

  // Test 10: Memoria KV está funcionando
  async testKVMemoryIsWorking() {
    const response = await this.makeRequest("hola", "test_kv");
    
    if (!response.reply) {
      return { success: false, message: "No response received" };
    }
    
    const hasMemory = response.hasMemory === true;
    const hasPlayerProfile = response.playerProfile && typeof response.playerProfile === 'object';
    
    if (hasMemory && hasPlayerProfile) {
      return { success: true, message: "KV memory is working correctly" };
    } else {
      return { success: false, message: `KV memory not working, got: ${JSON.stringify(response)}` };
    }
  }

  async runAllTests() {
    console.log(`${colors.bold}${colors.blue}🤖 GARÇABOT REGRESSION TESTS${colors.reset}`);
    console.log(`${colors.blue}Testing bot functionality at: ${BASE_URL}${colors.reset}\n`);

    // Ejecutar todos los tests
    await this.test("Preguntas generales (sin identificación)", () => this.testGeneralQuestions());
    await this.test("Preguntas personalizadas requieren identificación", () => this.testPersonalQuestionsRequireIdentification());
    await this.test("Identificación exitosa", () => this.testSuccessfulIdentification());
    await this.test("Memoria entre mensajes", () => this.testMemoryBetweenMessages());
    await this.test("Validación de nombres inexistentes", () => this.testInvalidNameValidation());
    await this.test("Sin humor político en mensajes normales", () => this.testPoliticalHumorOnlyWhenInsulted());
    await this.test("Humor argentino cuando es insultado", () => this.testPoliticalHumorWhenInsulted());
    await this.test("Respuesta con datos reales de D1", () => this.testRealDataFromD1());
    await this.test("Workers AI funcionando", () => this.testWorkersAIIsWorking());
    await this.test("Memoria KV funcionando", () => this.testKVMemoryIsWorking());

    // Mostrar resultados
    console.log(`\n${colors.bold}📊 TEST RESULTS:${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${this.results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${this.results.failed}${colors.reset}`);
    console.log(`${colors.blue}📈 Total: ${this.results.total}${colors.reset}`);
    
    if (this.results.failed > 0) {
      console.log(`\n${colors.red}${colors.bold}❌ FAILURES:${colors.reset}`);
      this.results.errors.forEach(error => {
        console.log(`${colors.red}  • ${error}${colors.reset}`);
      });
    }

    // Guardar resultados en archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `test-report-${timestamp}.json`;
    
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      results: this.results
    }, null, 2));

    console.log(`\n${colors.blue}📄 Report saved to: ${reportFile}${colors.reset}`);

    // Exit code basado en resultados
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Ejecutar tests si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BotTester();
  tester.runAllTests().catch(error => {
    console.error(`${colors.red}💥 Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

export default BotTester;
