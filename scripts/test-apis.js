#!/usr/bin/env node

// Script para probar las APIs del bot
import https from 'https';
import http from 'http';

// Configuración
const CONFIG = {
  local: 'http://localhost:8787',
  production: 'https://baltc-liga-starter.pages.dev', // URL real del proyecto
  timeout: 10000
};

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Función para hacer requests
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: CONFIG.timeout
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          url: url
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Tests para las APIs
const tests = [
  {
    name: 'Health Check - Ping',
    url: '/api/ping',
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Bot Health Check',
    url: '/api/bot/health',
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Bot API - Mensaje de prueba "primero"',
    url: '/api/bot',
    method: 'POST',
    body: { message: 'primero', player: 'test_user', system: 'A' },
    expectedStatus: 200,
    validateResponse: (data) => {
      const response = JSON.parse(data);
      return response.reply && response.reply.includes('TEST EXITOSO');
    }
  },
  {
    name: 'Bot API - Mensaje de prueba "cago"',
    url: '/api/bot',
    method: 'POST',
    body: { message: 'cago', player: 'test_user', system: 'A' },
    expectedStatus: 200,
    validateResponse: (data) => {
      const response = JSON.parse(data);
      return response.reply && response.reply.includes('TEST EXITOSO');
    }
  },
  {
    name: 'Bot API - Mensaje aleatorio',
    url: '/api/bot',
    method: 'POST',
    body: { message: 'hola bot', player: 'test_user', system: 'A' },
    expectedStatus: 200,
    validateResponse: (data) => {
      const response = JSON.parse(data);
      return response.reply && response.hasLeagueData === true;
    }
  },
  {
    name: 'Standings API',
    url: '/api/standings',
    method: 'GET',
    expectedStatus: 200,
    validateResponse: (data) => {
      const response = JSON.parse(data);
      return Array.isArray(response);
    }
  }
];

// Función para ejecutar un test
async function runTest(test, baseUrl) {
  const fullUrl = baseUrl + test.url;
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(fullUrl, {
      method: test.method,
      body: test.body
    });
    const duration = Date.now() - startTime;

    let success = response.status === test.expectedStatus;
    
    if (success && test.validateResponse) {
      try {
        success = test.validateResponse(response.data);
      } catch (error) {
        success = false;
      }
    }

    return {
      name: test.name,
      success,
      status: response.status,
      duration,
      error: success ? null : `Expected status ${test.expectedStatus}, got ${response.status}`
    };

  } catch (error) {
    return {
      name: test.name,
      success: false,
      status: 0,
      duration: 0,
      error: error.message
    };
  }
}

// Función principal
async function runAllTests(environment = 'local') {
  const baseUrl = CONFIG[environment];
  
  if (!baseUrl) {
    console.error(`${colors.red}❌ Entorno no válido: ${environment}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.blue}🧪 Ejecutando tests para: ${environment} (${baseUrl})${colors.reset}\n`);

  const results = [];
  
  for (const test of tests) {
    process.stdout.write(`⏳ ${test.name}... `);
    
    const result = await runTest(test, baseUrl);
    results.push(result);
    
    if (result.success) {
      console.log(`${colors.green}✅ OK (${result.duration}ms)${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset}`);
      if (result.error) {
        console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
      }
    }
  }

  // Resumen
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n${colors.blue}📊 Resumen:${colors.reset}`);
  console.log(`${colors.green}✅ Pasaron: ${passed}/${total}${colors.reset}`);
  console.log(`${colors.red}❌ Fallaron: ${total - passed}/${total}${colors.reset}`);
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  console.log(`${colors.yellow}⏱️  Tiempo promedio: ${Math.round(avgDuration)}ms${colors.reset}`);

  // Exit code basado en resultados
  process.exit(passed === total ? 0 : 1);
}

// Ejecutar tests
const environment = process.argv[2] || 'local';
runAllTests(environment).catch(error => {
  console.error(`${colors.red}❌ Error ejecutando tests: ${error.message}${colors.reset}`);
  process.exit(1);
});
