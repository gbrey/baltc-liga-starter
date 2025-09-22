#!/usr/bin/env node

/**
 * Script de verificación después del deploy a producción
 * Verifica que todo esté funcionando correctamente
 */

const PRODUCTION_URL = 'https://baltc-liga-starter.pages.dev';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function verifyProduction() {
  log('\n🧪 VERIFICANDO DEPLOY DE PRODUCCIÓN', colors.bold + colors.blue);
  
  let tests = 0;
  let passed = 0;
  let failed = 0;

  // Test 1: Verificar que la app principal carga
  tests++;
  try {
    const response = await fetch(PRODUCTION_URL);
    if (response.ok) {
      log('✅ App principal carga correctamente', colors.green);
      passed++;
    } else {
      log(`❌ App principal falló (${response.status})`, colors.red);
      failed++;
    }
  } catch (error) {
    log(`❌ Error al cargar app principal: ${error.message}`, colors.red);
    failed++;
  }

  // Test 2: Verificar que el admin carga
  tests++;
  try {
    const response = await fetch(`${PRODUCTION_URL}/admin`);
    if (response.ok) {
      log('✅ Panel de administración carga correctamente', colors.green);
      passed++;
    } else {
      log(`❌ Panel de administración falló (${response.status})`, colors.red);
      failed++;
    }
  } catch (error) {
    log(`❌ Error al cargar admin: ${error.message}`, colors.red);
    failed++;
  }

  // Test 3: Verificar que el bot responde
  tests++;
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        log('✅ Bot responde correctamente', colors.green);
        passed++;
      } else {
        log(`❌ Bot no responde correctamente: ${data.error}`, colors.red);
        failed++;
      }
    } else {
      log(`❌ Bot falló (${response.status})`, colors.red);
      failed++;
    }
  } catch (error) {
    log(`❌ Error al probar bot: ${error.message}`, colors.red);
    failed++;
  }

  // Test 4: Verificar que el dashboard tiene datos
  tests++;
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/admin/bot-dashboard`, {
      headers: { 'Authorization': 'Basic YWRtaW46Q2F0ZWdvcmlhQw==' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.leagueData.totalPlayers > 0) {
        log(`✅ Dashboard tiene datos (${data.data.leagueData.totalPlayers} jugadores)`, colors.green);
        passed++;
      } else {
        log('❌ Dashboard no tiene datos de la liga', colors.red);
        failed++;
      }
    } else {
      log(`❌ Dashboard falló (${response.status})`, colors.red);
      failed++;
    }
  } catch (error) {
    log(`❌ Error al probar dashboard: ${error.message}`, colors.red);
    failed++;
  }

  // Test 5: Verificar que Workers AI funciona
  tests++;
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '¿Cuántos jugadores hay en la liga?' })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.aiPowered) {
        log('✅ Workers AI funciona correctamente', colors.green);
        passed++;
      } else {
        log('❌ Workers AI no funciona', colors.red);
        failed++;
      }
    } else {
      log(`❌ Workers AI falló (${response.status})`, colors.red);
      failed++;
    }
  } catch (error) {
    log(`❌ Error al probar Workers AI: ${error.message}`, colors.red);
    failed++;
  }

  // Resumen final
  log('\n📊 RESUMEN DE VERIFICACIÓN:', colors.bold + colors.blue);
  log(`Total de tests: ${tests}`, colors.blue);
  log(`✅ Pasados: ${passed}`, colors.green);
  log(`❌ Fallidos: ${failed}`, colors.red);
  
  if (failed === 0) {
    log('\n🎉 ¡VERIFICACIÓN EXITOSA! Producción funcionando correctamente', colors.bold + colors.green);
    process.exit(0);
  } else {
    log('\n⚠️  ALGUNOS TESTS FALLARON. Revisar la configuración', colors.bold + colors.yellow);
    process.exit(1);
  }
}

// Ejecutar verificación
verifyProduction().catch(error => {
  log(`❌ Error durante la verificación: ${error.message}`, colors.red);
  process.exit(1);
});
