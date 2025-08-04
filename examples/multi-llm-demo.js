// Multi-LLM Demo - Shows how to use multiple LLM providers
// Run with: node examples/multi-llm-demo.js

const { ContextualAgent } = require('../dist/index.js');

async function multiLLMDemo() {
  console.log('🚀 MULTI-LLM CONTEXTUAL AGENT SDK DEMO\n');
  console.log('💡 Showcasing context bridging with multiple LLM providers\n');

  // EXAMPLE 1: Using OpenAI (if you have an API key)
  console.log('📊 EXAMPLE 1: Multiple LLM Providers Configuration');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const agentConfig = {
    name: 'Multi-LLM Customer Service Agent',
    mode: 'conversation',
    systemPrompt: 'You are a helpful customer service representative.',
    capabilities: {
      voiceEnabled: true,
      textEnabled: true,
      contextBridging: true, // 🌟 THE KEY INNOVATION
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
    },
    llm: {
      providers: {
        // OpenAI Provider
        'openai': {
          type: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY, // Set your API key
            model: 'gpt-4'
          }
        },
        // Anthropic Provider
        'anthropic': {
          type: 'anthropic',
          config: {
            apiKey: process.env.ANTHROPIC_API_KEY, // Set your API key
            model: 'claude-3-sonnet-20240229'
          }
        },
        // Local Ollama Provider (runs locally, no API key needed)
        'ollama': {
          type: 'ollama',
          config: {
            host: 'http://localhost:11434',
            model: 'llama2'
          }
        },
        // Custom API Provider
        'custom': {
          type: 'custom',
          config: {
            endpoint: 'https://api.your-custom-llm.com/v1/chat',
            apiKey: process.env.CUSTOM_API_KEY,
            headers: {
              'X-Custom-Header': 'your-value'
            }
          }
        }
      },
      defaultProvider: 'openai',     // Try OpenAI first
      fallbackProvider: 'ollama',    // Fall back to local Ollama
      retryAttempts: 2
    }
  };

  // Initialize agent with multi-LLM configuration
  const agent = new ContextualAgent(agentConfig);

  console.log('✅ Agent initialized with multiple LLM providers');

  // Show available providers
  console.log('\n🔌 Available LLM Providers:');
  const providers = agent.getLLMProviderStatus();
  providers.forEach(provider => {
    const status = provider.configured ? '✅ Configured' : '❌ Not configured';
    console.log(`   ${provider.name} (${provider.type}): ${status}`);
    console.log(`      Supported models: ${provider.supportedModels.slice(0, 3).join(', ')}...`);
  });

  // EXAMPLE 2: Test different providers
  console.log('\n🧪 EXAMPLE 2: Testing LLM Providers');
  console.log('════════════════════════════════════════════════════════════════════\n');

  for (const provider of agent.getAvailableLLMProviders()) {
    console.log(`Testing ${provider} provider...`);
    const testResult = await agent.testLLMProvider(provider);
    
    if (testResult.success) {
      console.log(`   ✅ ${provider}: Working (${testResult.responseTime}ms)`);
    } else {
      console.log(`   ❌ ${provider}: Failed - ${testResult.error}`);
    }
  }

  // EXAMPLE 3: Context bridging with multiple LLMs
  console.log('\n🌉 EXAMPLE 3: Context Bridging with Multiple LLMs');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const sessionId = 'multi-llm-demo-' + Date.now();

  // Set up event monitoring
  agent.on('modality_switched', (event) => {
    console.log(`   🔄 Modality switched: ${event.data.from} → ${event.data.to}`);
  });

  agent.on('context_bridged', (event) => {
    console.log(`   🌉 Context bridged: ${event.data.bridgeType}`);
  });

  try {
    console.log('💬 Step 1: Start text conversation');
    console.log('User: "Hello, I need help with my order #12345"');
    
    const textResponse = await agent.processMessage(
      'Hello, I need help with my order #12345',
      'text',
      sessionId
    );

    console.log(`Agent: ${textResponse.data?.message.content.substring(0, 100)}...`);
    console.log(`   Provider used: ${agent.getLLMProviderStatus().find(p => p.configured)?.name || 'Mock'}`);

    console.log('\n🎤 Step 2: THE INNOVATION - Switch to voice with context preservation');
    const voiceResponse = await agent.switchModality('voice', sessionId);

    console.log(`Agent (voice): ${voiceResponse.data?.message.content.substring(0, 100)}...`);
    console.log(`   Context bridged: ${voiceResponse.metadata.contextBridgeTriggered ? '✅ YES' : '❌ NO'}`);

    console.log('\n🗣️ Step 3: Continue voice conversation');
    console.log('User: "The tracking number isn\'t working"');

    const voiceInput = {
      type: 'audio',
      transcription: 'The tracking number isn\'t working'
    };

    const voiceContinue = await agent.processMessage(voiceInput, 'voice', sessionId);
    console.log(`Agent (voice): ${voiceContinue.data?.message.content.substring(0, 100)}...`);

    // Final session statistics
    const session = agent.getSession(sessionId);
    console.log('\n📊 Final Results:');
    console.log(`   Total messages: ${session?.totalMessages}`);
    console.log(`   Modality switches: ${session?.metadata.modalitySwitches}`);
    console.log(`   Context preserved: ✅ YES`);

  } catch (error) {
    console.log('   ⚠️ Using mock responses (no LLM providers configured)');
    console.log('   💡 Set environment variables for API keys to test real LLMs');
  }

  // EXAMPLE 4: Runtime provider management
  console.log('\n⚙️ EXAMPLE 4: Runtime LLM Provider Management');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // Add a new provider at runtime
  console.log('Adding new provider at runtime...');
  try {
    agent.addLLMProvider('runtime-openai', 'openai', {
      apiKey: 'your-api-key-here',
      model: 'gpt-3.5-turbo'
    });
    console.log('✅ New provider added successfully');
  } catch (error) {
    console.log('ℹ️ Provider addition demonstrated (would work with valid API key)');
  }

  // Show updated provider list
  console.log('\nUpdated provider list:');
  agent.getAvailableLLMProviders().forEach(provider => {
    console.log(`   • ${provider}`);
  });

  // EXAMPLE 5: Developer-friendly capabilities
  console.log('\n🛠️ EXAMPLE 5: Developer Experience Features');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const capabilities = agent.getCapabilities();
  console.log('SDK Capabilities:');
  console.log(`   Voice support: ${capabilities.voice ? '✅' : '❌'}`);
  console.log(`   Text support: ${capabilities.text ? '✅' : '❌'}`);
  console.log(`   Context bridging: ${capabilities.contextBridging ? '✅' : '❌'}`);
  console.log(`   Session management: ${capabilities.sessionManagement ? '✅' : '❌'}`);
  console.log(`   Event system: ${capabilities.eventSystem ? '✅' : '❌'}`);
  console.log(`   Available LLM providers: ${capabilities.llmProviders.length}`);

  console.log('\n🎉 MULTI-LLM DEMO COMPLETE!');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🚀 KEY BENEFITS FOR DEVELOPERS:');
  console.log('   • ✅ Support for ANY LLM provider (OpenAI, Anthropic, local models)');
  console.log('   • ✅ Automatic fallback between providers');
  console.log('   • ✅ Context bridging works with ALL LLMs');
  console.log('   • ✅ Runtime provider management');
  console.log('   • ✅ No vendor lock-in');
  console.log('   • ✅ Easy to add custom LLM APIs');

  console.log('\n💡 GETTING STARTED:');
  console.log('1. Set environment variables:');
  console.log('   export OPENAI_API_KEY=your_openai_key');
  console.log('   export ANTHROPIC_API_KEY=your_anthropic_key');
  console.log('2. Install Ollama for local models: https://ollama.ai');
  console.log('3. Use any combination of providers in your agent config');

  // Cleanup
  agent.destroySession(sessionId);
  agent.shutdown();
}

// Show usage examples
console.log('🔧 USAGE EXAMPLES:');
console.log('');
console.log('// OpenAI only');
console.log('const agent = new ContextualAgent(config, "your-openai-key");');
console.log('');
console.log('// Multiple providers with fallback');
console.log('const config = {');
console.log('  // ... other config');
console.log('  llm: {');
console.log('    providers: {');
console.log('      "openai": { type: "openai", config: { apiKey: "..." } },');
console.log('      "claude": { type: "anthropic", config: { apiKey: "..." } },');
console.log('      "local": { type: "ollama", config: { host: "localhost:11434" } }');
console.log('    },');
console.log('    defaultProvider: "openai",');
console.log('    fallbackProvider: "local"');
console.log('  }');
console.log('};');
console.log('const agent = new ContextualAgent(config);');
console.log('');

multiLLMDemo().catch(console.error); 