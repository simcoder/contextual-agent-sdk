// Unit test for SessionStateManager
// Run with: node tests/core/session-manager.test.js

const { SessionStateManager } = require('../../dist/core/SessionStateManager.js');

async function testSessionStateManager() {
  console.log('🧪 UNIT TEST: SessionStateManager\n');

  const sessionManager = new SessionStateManager();
  const sessionId = 'test-session-' + Date.now();
  const userId = 'test-user-123';

  console.log('✅ SessionStateManager initialized');

  const tests = [];

  try {
    // Test 1: Create session
    console.log('\n📝 TEST 1: Create session');
    const session = await sessionManager.createSession(sessionId, userId);
    
    tests.push({
      name: 'Session creation',
      passed: session && session.sessionId === sessionId && session.userId === userId
    });
    console.log('   Session ID:', session.sessionId);
    console.log('   User ID:', session.userId);
    console.log('   Start time:', session.startTime);

    // Test 2: Get session
    console.log('\n📝 TEST 2: Get session');
    const retrievedSession = await sessionManager.getSession(sessionId);
    
    tests.push({
      name: 'Session retrieval',
      passed: retrievedSession && retrievedSession.sessionId === sessionId
    });

    // Test 3: Update session with message
    console.log('\n📝 TEST 3: Update session with message');
    const mockMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello world',
      modality: 'text',
      timestamp: new Date()
    };

    const updatedSession = await sessionManager.updateSession(sessionId, mockMessage, 'text');
    
    tests.push({
      name: 'Session update',
      passed: updatedSession.totalMessages === 1 && updatedSession.currentModality === 'text'
    });
    console.log('   Total messages:', updatedSession.totalMessages);
    console.log('   Current modality:', updatedSession.currentModality);

    // Test 4: Context bridging
    console.log('\n📝 TEST 4: Context bridging (THE INNOVATION)');
    const bridgedContext = await sessionManager.bridgeContextForModality(sessionId, 'voice');
    
    tests.push({
      name: 'Context bridging',
      passed: typeof bridgedContext === 'string' && bridgedContext.length > 0
    });
    console.log('   Bridged context length:', bridgedContext.length);
    console.log('   Context preview:', bridgedContext.substring(0, 100) + '...');

    // Test 5: Conversation summary
    console.log('\n📝 TEST 5: Conversation summary');
    const summary = await sessionManager.getConversationSummary(sessionId);
    
    tests.push({
      name: 'Conversation summary',
      passed: typeof summary === 'string'
    });
    console.log('   Summary length:', summary.length);

    // Test 6: Session statistics
    console.log('\n📝 TEST 6: Session statistics');
    const sessionWithStats = await sessionManager.getSession(sessionId);
    const stats = sessionWithStats?.metadata;
    
    tests.push({
      name: 'Session statistics',
      passed: stats && typeof stats.modalitySwitches === 'number'
    });
    console.log('   Modality switches:', stats?.modalitySwitches);

    // Test 7: Destroy session
    console.log('\n📝 TEST 7: Destroy session');
    const destroyed = await sessionManager.destroySession(sessionId);
    const destroyedSession = await sessionManager.getSession(sessionId);
    
    tests.push({
      name: 'Session destruction',
      passed: destroyed === true && destroyedSession === null
    });
    console.log('   Destruction successful:', destroyed);
    console.log('   Session retrieved after destruction:', destroyedSession === null ? 'NULL' : 'EXISTS');

  } catch (error) {
    console.error('❌ Test error:', error.message);
    tests.push({
      name: 'Error handling',
      passed: false
    });
  }

  // Results
  console.log('\n🧪 UNIT TEST RESULTS:');
  let passedTests = 0;
  tests.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status}: ${test.name}`);
    if (test.passed) passedTests++;
  });

  console.log(`\n🎯 FINAL SCORE: ${passedTests}/${tests.length} tests passed`);

  if (passedTests === tests.length) {
    console.log('🎉 ALL UNIT TESTS PASSED - SessionStateManager Works!');
  } else {
    console.log('⚠️  Some tests failed - Check SessionStateManager implementation');
  }

  // Cleanup
  await sessionManager.shutdown();

  return passedTests === tests.length;
}

// Export for test runner or run directly
if (require.main === module) {
  testSessionStateManager()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testSessionStateManager }; 