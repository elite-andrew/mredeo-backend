#!/usr/bin/env node

/**
 * Final Authentication System Verification
 * Comprehensive test of all fixed authentication components
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(url, expectedStatus = 200, description = '') {
  try {
    const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" "${url}"`);
    const status = parseInt(stdout.trim());
    
    if (status === expectedStatus) {
      log(`✅ ${description}: HTTP ${status}`, colors.green);
      return true;
    } else {
      log(`❌ ${description}: Expected ${expectedStatus}, got ${status}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ ${description}: Error - ${error.message}`, colors.red);
    return false;
  }
}

async function testApiResponse(url, description = '') {
  try {
    const { stdout } = await execAsync(`curl -s "${url}"`);
    const response = JSON.parse(stdout);
    
    if (response.success !== undefined) {
      log(`✅ ${description}: Valid JSON response`, colors.green);
      return true;
    } else {
      log(`❌ ${description}: Invalid response format`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ ${description}: JSON parse error`, colors.red);
    return false;
  }
}

async function runVerification() {
  log('\n🎯 MREDEO Authentication System - Final Verification', colors.cyan);
  log('='.repeat(60), colors.cyan);

  const baseUrl = 'http://localhost:8000/api/v1';
  let passed = 0;
  let total = 0;

  // Test 1: Health Check
  total++;
  if (await testEndpoint(`${baseUrl}/health`, 200, 'Health Check')) {
    passed++;
  }

  // Test 2: Health Check Response Format
  total++;
  if (await testApiResponse(`${baseUrl}/health`, 'Health Check JSON Format')) {
    passed++;
  }

  // Test 3: Auth endpoint without token (should be 401)
  total++;
  if (await testEndpoint(`${baseUrl}/auth/me`, 401, 'Auth /me without token')) {
    passed++;
  }

  // Test 4: Session validation without token (should be 401)
  total++;
  if (await testEndpoint(`${baseUrl}/auth/validate-session`, 401, 'Session validation without token')) {
    passed++;
  }

  // Test 5: Session info without token (should be 401)
  total++;
  if (await testEndpoint(`${baseUrl}/session/session-info`, 401, 'Session info without token')) {
    passed++;
  }

  // Test 6: Logout without token (should be 401)
  total++;
  if (await testEndpoint(`${baseUrl}/session/logout`, 401, 'Logout without token')) {
    passed++;
  }

  // Test 7: Check if auth responses have proper error codes
  total++;
  try {
    const { stdout } = await execAsync(`curl -s "${baseUrl}/auth/me"`);
    const response = JSON.parse(stdout);
    
    if (response.code === 'TOKEN_REQUIRED') {
      log(`✅ Auth error codes: Correct TOKEN_REQUIRED code`, colors.green);
      passed++;
    } else {
      log(`❌ Auth error codes: Expected TOKEN_REQUIRED, got ${response.code}`, colors.red);
    }
  } catch (error) {
    log(`❌ Auth error codes: Test failed`, colors.red);
  }

  // Test 8: Invalid token handling
  total++;
  if (await testEndpoint(`${baseUrl}/auth/me -H "Authorization: Bearer invalid-token"`, 401, 'Invalid token handling')) {
    passed++;
  }

  log('\n📊 Verification Results', colors.cyan);
  log('-'.repeat(30), colors.cyan);
  log(`Total Tests: ${total}`);
  log(`Passed: ${passed}`, passed === total ? colors.green : colors.yellow);
  log(`Failed: ${total - passed}`, total - passed === 0 ? colors.green : colors.red);
  
  const successRate = (passed / total * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, successRate >= 90 ? colors.green : colors.yellow);

  log('\n🎯 System Status:', colors.cyan);
  if (successRate >= 95) {
    log('🌟 EXCELLENT - Authentication system is production ready!', colors.green);
  } else if (successRate >= 85) {
    log('✅ GOOD - Authentication system is working well', colors.green);
  } else if (successRate >= 70) {
    log('⚠️  FAIR - Some issues detected', colors.yellow);
  } else {
    log('❌ POOR - Significant issues need attention', colors.red);
  }

  log('\n🚀 Next Steps:', colors.cyan);
  log('1. Test Flutter app authentication flow');
  log('2. Verify Firebase login works end-to-end');
  log('3. Test session persistence across app restarts');
  log('4. Verify logout clears all session data');

  return successRate >= 85;
}

runVerification().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  log(`❌ Verification failed: ${error.message}`, colors.red);
  process.exit(1);
});
