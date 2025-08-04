// Context Provider Demo - Shows external knowledge integration with Knowledge Base and Database
// Run with: node examples/context-provider-demo.js

const { ContextualAgent } = require('../dist/index.js');
const { KnowledgeBaseProvider } = require('../dist/providers/KnowledgeBaseProvider.js');
const { DatabaseContextProvider } = require('../dist/providers/DatabaseContextProvider.js');
const path = require('path');

async function contextProviderDemo() {
  console.log('🚀 Context Provider Demo - External Knowledge Integration\n');

  // 1. Create Knowledge Base Provider for Company Information
  const knowledgeProvider = new KnowledgeBaseProvider({
    id: 'company-knowledge',
    name: 'Company Knowledge Base',
    enabled: true,
    priority: 90,
    options: {
      // Auto-discover documentation in current directory
      autoDiscoverDocs: {
        enabled: true,
        rootPath: process.cwd(),
        patterns: ['README.md', 'docs/**/*.md', '*.md'],
        recursive: true
      },
      
      // Add specific knowledge sources
      sources: [
        {
          type: 'custom',
          path: 'company-policies',
          format: 'text'
        }
      ],
      
      // Custom search function for dynamic content
      customSearch: async (query) => {
        const results = [];
        
        // Product information
        if (query.toLowerCase().includes('product') || query.toLowerCase().includes('service')) {
          results.push({
            title: 'Our Services',
            content: `We offer:
            • Contextual Agent SDK - Build voice and text agents with seamless context switching
            • Context Bridging Technology - Innovative voice ↔ text conversation continuity  
            • Multi-LLM Support - OpenAI, Anthropic, Ollama providers
            • Telephony Integration - Twilio Voice and SMS support
            • Real-time Context Management - Persistent conversations across channels`,
            source: 'service-catalog',
            weight: 1.0,
            tags: ['products', 'services']
          });
        }
        
        // Pricing information
        if (query.toLowerCase().includes('price') || query.toLowerCase().includes('cost')) {
          results.push({
            title: 'Pricing Information', 
            content: 'Our SDK is open source and available on npm. Enterprise support and custom implementations available on request.',
            source: 'pricing',
            weight: 0.9,
            tags: ['pricing', 'cost']
          });
        }
        
        // Support information
        if (query.toLowerCase().includes('support') || query.toLowerCase().includes('help')) {
          results.push({
            title: 'Support Options',
            content: `Get help with:
            • Documentation and examples on GitHub
            • Community support via issues and discussions
            • Enterprise support for production deployments
            • Custom integration assistance
            • Training and workshops available`,
            source: 'support-docs',
            weight: 0.8,
            tags: ['support', 'help']
          });
        }
        
        return results;
      },
      
      searchType: 'fuzzy',
      maxResults: 5
    }
  });

  // 2. Create Database Provider for Customer Data
  const databaseProvider = new DatabaseContextProvider({
    id: 'customer-database',
    name: 'Customer Database',
    enabled: true,
    priority: 85,
    config: {
      type: 'simulation', // In real usage, this would be 'postgresql', 'mysql', etc.
      queries: {
        customer_lookup: 'SELECT * FROM customers WHERE phone = ?',
        usage_stats: 'SELECT * FROM usage_analytics WHERE user_id = ?',
        subscription_info: 'SELECT * FROM subscriptions WHERE customer_id = ?'
      }
    },
    
    // Mock database execution (replace with real database in production)
    executeQuery: async (query, params) => {
      console.log(`📊 Database Query: ${query} with params:`, params);
      
      // Simulate customer data lookup
      if (query.includes('customers')) {
        const phone = params[0];
        
        // Mock customer database
        const customers = {
          '+15551234567': {
            customer_id: 'CUST-001',
            name: 'TechCorp Solutions',
            phone: '+15551234567',
            email: 'admin@techcorp.com',
            plan: 'Enterprise',
            signup_date: '2023-08-15',
            last_login: '2024-01-15',
            total_api_calls: 125000,
            status: 'Active'
          },
          '+15559876543': {
            customer_id: 'CUST-002', 
            name: 'StartupAI Inc',
            phone: '+15559876543',
            email: 'dev@startupai.com',
            plan: 'Professional',
            signup_date: '2023-11-22',
            last_login: '2024-01-14',
            total_api_calls: 45000,
            status: 'Active'
          }
        };
        
        return customers[phone] ? [customers[phone]] : [];
      }
      
      // Simulate usage analytics
      if (query.includes('usage_analytics')) {
        return [{
          user_id: params[0],
          total_conversations: 1250,
          avg_session_length: '8.5 minutes',
          most_used_feature: 'Context Bridging',
          satisfaction_score: 4.7,
          last_30_days_usage: 15000
        }];
      }
      
      return [];
    }
  });

  // 3. Initialize Agent with Context Providers
  const agent = new ContextualAgent({
    name: 'Customer Service Agent with RAG',
    mode: 'conversation',
    systemPrompt: `You are a helpful customer service agent for the Contextual Agent SDK. 
    Use the available knowledge base and customer information to provide accurate, personalized responses. 
    Always be professional and helpful.`,
    
    capabilities: {
      voiceEnabled: true,
      textEnabled: true,
      contextBridging: true,
      memoryRetention: true,
      emotionRecognition: false,
      taskExecution: false
    },
    
    contextSettings: {
      maxHistoryLength: 20,
      contextWindowSize: 8000, // Larger window for rich context
      relevanceThreshold: 0.6,
      memoryRetentionDays: 30,
      modalitySwitchSensitivity: 0.8
    },
    
    // 🎯 KEY: Add context providers for external knowledge integration
    contextProviders: [knowledgeProvider, databaseProvider]
  });

  // 4. Set up event listeners to observe external knowledge integration in action
  agent.on('external_context_retrieved', (event) => {
    console.log(`📚 External knowledge retrieved for session ${event.sessionId}:`);
    console.log(`   - ${event.data.contextSources} knowledge sources found`);
    console.log(`   - Has external knowledge: ${event.data.hasExternalKnowledge}`);
  });

  agent.on('context_bridged', (event) => {
    console.log(`🌉 Context bridged in session ${event.sessionId}:`);
    console.log(`   - Bridge type: ${event.data.bridgeType}`);
  });

  console.log('✅ Agent initialized with external knowledge capabilities\n');
  console.log('🧪 Starting demo scenarios...\n');

  try {
    // Demo Scenario 1: General Product Inquiry
    console.log('📝 Scenario 1: General Product Inquiry');
    console.log('Customer Question: "What services do you offer?"');
    
    const response1 = await agent.processMessage(
      'What services do you offer and how much do they cost?',
      'text',
      'demo-session-1'
    );
    
    console.log('🤖 Agent Response:');
    console.log(`   ${response1.data.message.content}\n`);
    
    // Demo Scenario 2: Customer-Specific Inquiry
    console.log('📝 Scenario 2: Personalized Customer Service');
    console.log('Known Customer (+15551234567) asks: "What is my current usage?"');
    
    const response2 = await agent.processMessage(
      'Hi, can you check my account status and usage statistics?',
      'text',
      'demo-session-2',
      '+15551234567' // Known customer ID
    );
    
    console.log('🤖 Agent Response:');
    console.log(`   ${response2.data.message.content}\n`);
    
    // Demo Scenario 3: Context Bridging with External Knowledge
    console.log('📝 Scenario 3: Context Bridging + External Knowledge');
    console.log('Voice → Text conversation with external knowledge');
    
    // Start with voice
    const voiceResponse = await agent.processMessage(
      'I need help getting started with your SDK',
      'voice',
      'demo-session-3',
      '+15559876543'
    );
    
    console.log('🗣️ Voice Response Generated');
    
    // Switch to text - triggers context bridging + uses external knowledge
    const textResponse = await agent.processMessage(
      'What support options are available?',
      'text',
      'demo-session-3',
      '+15559876543'
    );
    
    console.log('📱 Text Response with Context Bridging:');
    console.log(`   ${textResponse.data.message.content}\n`);
    
    // Demo Scenario 4: Multi-turn conversation with knowledge retention
    console.log('📝 Scenario 4: Multi-turn Conversation');
    console.log('Building conversation context with external knowledge');
    
    await agent.processMessage(
      'I am interested in your context bridging technology',
      'text',
      'demo-session-4'
    );
    
    await agent.processMessage(
      'How does it compare to other solutions?',
      'text',
      'demo-session-4'
    );
    
    const finalResponse = await agent.processMessage(
      'Can you give me pricing for an enterprise deployment?',
      'text',
      'demo-session-4'
    );
    
    console.log('🤖 Final Response (with conversation + external context):');
    console.log(`   ${finalResponse.data.message.content}\n`);
    
    // Show session statistics
    console.log('📊 Demo Statistics:');
    const session = await agent.getSession('demo-session-4');
    if (session) {
      console.log(`   - Total messages: ${session.totalMessages}`);
      console.log(`   - Session duration: ${new Date() - session.startTime}ms`);
      console.log(`   - Current modality: ${session.currentModality}`);
      console.log(`   - Memory items: ${session.context.memoryBank.length}`);
    }
    
  } catch (error) {
    console.error('❌ Demo error:', error);
  } finally {
    await agent.shutdown();
    console.log('\n✅ Demo completed successfully!');
    console.log('\n🎯 Key Takeaways:');
    console.log('   • Context providers successfully integrated with ContextualAgent');
    console.log('   • External knowledge automatically retrieved based on user queries');
    console.log('   • Customer data combined with conversation context');
    console.log('   • Context bridging works seamlessly with external knowledge capabilities');
    console.log('   • Multi-source knowledge combination enhances responses');
  }
}

// Export for use as module or run directly
if (require.main === module) {
  contextProviderDemo()
    .catch(console.error);
}

module.exports = { contextProviderDemo };