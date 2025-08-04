// Integration test for Context Bridging Innovation
// Run with: npm test or node tests/integration/context-bridging.test.js

const { ContextualAgent } = require('../../dist/index.js');

async function testContextBridging() {
  console.log('🧪 INTEGRATION TEST: Context Bridging Innovation\n');

  const agentConfig = {
    name: 'Test Agent',
    mode: 'conversation',
    systemPrompt: 'You are a helpful assistant.',
    capabilities: {
      voiceEnabled: true,
      textEnabled: true,
      contextBridging: true,
      memoryRetention: true,
      emotionRecognition: false,
      taskExecution: false
    },
    contextSettings: {
      maxHistoryLength: 10,
      contextWindowSize: 4000,
      relevanceThreshold: 0.7,
      memoryRetentionDays: 7,
      modalitySwitchSensitivity: 0.8
    }
  };

  const agent = new ContextualAgent(agentConfig);
  
  console.log('✅ Agent initialized successfully');

  // Test event system
  let modalitySwitched = false;
  let contextBridged = false;

  agent.on('modality_switched', (event) => {
    modalitySwitched = true;
    console.log('🔄 Modality switched:', event.data.from, '→', event.data.to);
  });

  agent.on('context_bridged', (event) => {
    contextBridged = true;
    console.log('🌉 Context bridged:', event.data.bridgeType);
  });

  const sessionId = 'integration-test-' + Date.now();

  try {
    console.log('\n📝 TEST 1: Text conversation');
    const textResponse = await agent.processMessage(
      'Hello, I need help with order #12345',
      'text',
      sessionId
    );

    console.log('✅ Text response received');
    console.log('   Content length:', textResponse.data?.message.content.length);
    console.log('   Response time:', textResponse.metadata.responseTime + 'ms');

    console.log('\n🎤 TEST 2: THE INNOVATION - Modality switch');
    const voiceResponse = await agent.switchModality('voice', sessionId);

    console.log('✅ Voice switch completed');
    console.log('   Modality switched:', modalitySwitched ? '✅' : '❌');
    console.log('   Context bridged:', contextBridged ? '✅' : '❌');

    console.log('\n🗣️ TEST 3: Voice conversation');
    const voiceInput = { type: 'audio', transcription: 'Status update please' };
    const voiceContinue = await agent.processMessage(voiceInput, 'voice', sessionId);

    console.log('✅ Voice message processed');

    console.log('\n💬 TEST 4: Back to text');
    const textSwitch = await agent.switchModality('text', sessionId);

    console.log('✅ Text switch completed');

    // Verify session state
    const session = await agent.getSession(sessionId);
    const summary = await agent.getConversationSummary(sessionId);

    console.log('\n📊 INTEGRATION TEST RESULTS:');
    console.log('✅ Total messages:', session?.totalMessages);
    console.log('✅ Modality switches:', session?.metadata.modalitySwitches);
    console.log('✅ Session active:', session ? 'YES' : 'NO');
    console.log('✅ Summary generated:', summary.length > 0 ? 'YES' : 'NO');

    // Test assertions
    const tests = [
      { name: 'Agent initialization', passed: agent !== null },
      { name: 'Text message processing', passed: textResponse.success },
      { name: 'Modality switching', passed: modalitySwitched },
      { name: 'Context bridging', passed: contextBridged },
      { name: 'Voice processing', passed: voiceContinue.success },
      { name: 'Session management', passed: session !== null },
      { name: 'Conversation summary', passed: summary.length > 0 }
    ];

    console.log('\n🧪 TEST RESULTS:');
    let passedTests = 0;
    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${status}: ${test.name}`);
      if (test.passed) passedTests++;
    });

    console.log(`\n🎯 FINAL SCORE: ${passedTests}/${tests.length} tests passed`);

    if (passedTests === tests.length) {
      console.log('🎉 ALL TESTS PASSED - Context Bridging Innovation Works!');
    } else {
      console.log('⚠️  Some tests failed - Check implementation');
    }

    // Cleanup
    await agent.destroySession(sessionId);
    await agent.shutdown();

    return passedTests === tests.length;

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

// Export for test runner or run directly
if (require.main === module) {
  testContextBridging()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testContextBridging }; 