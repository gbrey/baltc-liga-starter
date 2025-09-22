#!/usr/bin/env node

/**
 * Script de validación antes del deploy a producción
 * Verifica que la configuración sea correcta
 */

import fs from 'fs';
import path from 'path';

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

async function validateConfig() {
  log('\n🔍 VALIDANDO CONFIGURACIÓN DE DEPLOY', colors.bold + colors.blue);
  
  let errors = 0;
  let warnings = 0;

  // Verificar que wrangler.toml apunta a desarrollo
  try {
    const devConfig = fs.readFileSync('wrangler.toml', 'utf8');
    
    if (devConfig.includes('baltc_liga_dev')) {
      log('✅ wrangler.toml configurado para desarrollo', colors.green);
    } else {
      log('❌ wrangler.toml NO apunta a desarrollo local', colors.red);
      errors++;
    }
  } catch (error) {
    log('❌ No se pudo leer wrangler.toml', colors.red);
    errors++;
  }

  // Verificar que wrangler.prod.toml apunta a producción
  try {
    const prodConfig = fs.readFileSync('wrangler.prod.toml', 'utf8');
    
    if (prodConfig.includes('baltc-db') && prodConfig.includes('ca7ea78d-e491-433c-9f79-fc245235a35a')) {
      log('✅ wrangler.prod.toml configurado para producción', colors.green);
    } else {
      log('❌ wrangler.prod.toml NO apunta a producción', colors.red);
      errors++;
    }
  } catch (error) {
    log('❌ No se pudo leer wrangler.prod.toml', colors.red);
    errors++;
  }

  // Verificar que no hay cambios sin commitear en archivos de configuración
  try {
    const { execSync } = await import('child_process');
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    
    const configFiles = status.split('\n').filter(line => 
      line.includes('wrangler.toml') || line.includes('wrangler.prod.toml')
    );
    
    if (configFiles.length > 0) {
      log('⚠️  Hay cambios sin commitear en archivos de configuración:', colors.yellow);
      configFiles.forEach(file => log(`   ${file.trim()}`, colors.yellow));
      warnings++;
    } else {
      log('✅ No hay cambios sin commitear en configuraciones', colors.green);
    }
  } catch (error) {
    log('⚠️  No se pudo verificar el estado de git', colors.yellow);
    warnings++;
  }

  // Verificar que el directorio scripts existe
  if (fs.existsSync('scripts')) {
    log('✅ Directorio scripts existe', colors.green);
  } else {
    log('❌ Directorio scripts no existe', colors.red);
    errors++;
  }

  // Resumen
  log('\n📊 RESUMEN DE VALIDACIÓN:', colors.bold + colors.blue);
  
  if (errors === 0 && warnings === 0) {
    log('🎉 ¡VALIDACIÓN EXITOSA! Listo para deploy a producción', colors.bold + colors.green);
    process.exit(0);
  } else if (errors === 0) {
    log(`⚠️  ${warnings} advertencias encontradas, pero se puede continuar`, colors.bold + colors.yellow);
    log('¿Deseas continuar con el deploy? (y/N)', colors.yellow);
    
    // En modo automático, continuar con warnings
    process.exit(0);
  } else {
    log(`❌ ${errors} errores encontrados. NO se puede hacer deploy`, colors.bold + colors.red);
    log('Corrige los errores antes de continuar', colors.red);
    process.exit(1);
  }
}

// Ejecutar validación
validateConfig().catch(error => {
  log(`❌ Error durante la validación: ${error.message}`, colors.red);
  process.exit(1);
});
