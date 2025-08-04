// Unit tests for Context Provider Integration
// Run with: npm test

const { ContextualAgent } = require('../../dist/index.js');
const { KnowledgeBaseProvider } = require('../../dist/providers/KnowledgeBaseProvider.js');
const { DatabaseContextProvider } = require('../../dist/providers/DatabaseContextProvider.js');

describe('Context Provider Integration', () => {
  let agent;
  let mockKnowledgeProvider;
  let mockDatabaseProvider;

  beforeEach(() => {
    // Create mock knowledge base provider
    mockKnowledgeProvider = new KnowledgeBaseProvider({
      id: 'test-knowledge',
      name: 'Test Knowledge Base',
      enabled: true,
      priority: 90,
      options: {
        sources: [
          {
            type: 'custom',
            path: 'mock://test-docs'
          }
        ],
        customSearch: async (query) => {
          // Mock search results based on query
          if (query.toLowerCase().includes('product')) {
            return [{
              title: 'Product Information',
              content: 'We sell widgets in blue, red, and green colors. Prices range from $10-50.',
              source: 'product-catalog',
              weight: 1.0,
              tags: ['products', 'catalog']
            }];
          }
          
          if (query.toLowerCase().includes('order')) {
            return [{
              title: 'Order Status',
              content: 'Orders typically ship within 2-3 business days. You can track orders online.',
              source: 'order-help',
              weight: 0.9,
              tags: ['orders', 'shipping']
            }];
          }
          
          return [];
        }
      }
    });

    // Create mock database provider
    mockDatabaseProvider = new DatabaseContextProvider({
      id: 'test-database',
      name: 'Test Database',
      enabled: true,
      priority: 80,
      config: {
        type: 'mock',
        queries: {
          customer_info: 'SELECT * FROM customers WHERE phone = ?',
          order_status: 'SELECT * FROM orders WHERE customer_id = ?'
        }
      },
      executeQuery: async (query, params) => {
        // Mock database responses
        if (query.includes('customers')) {
          return [{
            customer_id: 123,
            name: 'John Doe',
            phone: '+15551234567',
            email: 'john@example.com',
            membership: 'premium'
          }];
        }
        
        if (query.includes('orders')) {
          return [{
            order_id: 'ORD-12345',
            status: 'shipped',
            tracking: '1Z999AA1234567890',
            total: 29.99
          }];
        }
        
        return [];
      }
    });

    // Initialize agent with context providers
    agent = new ContextualAgent({
      name: 'Test Agent with Context',
      mode: 'conversation',
      systemPrompt: 'You are a helpful customer service agent.',
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
      },
      contextProviders: [mockKnowledgeProvider, mockDatabaseProvider]
    });
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Context Provider Configuration', () => {
    it('should initialize with context providers', () => {
      expect(agent).toBeDefined();
      // The agent should have initialized the ContextManager
      // (We can't directly test private properties, but we can test behavior)
    });

    it('should work without context providers', () => {
      const simpleAgent = new ContextualAgent({
        name: 'Simple Agent',
        mode: 'conversation',
        systemPrompt: 'You are a simple agent.',
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
        // No contextProviders
      });

      expect(simpleAgent).toBeDefined();
    });
  });

  describe('Knowledge Base Integration', () => {
    it('should retrieve product information from knowledge base', async () => {
      const sessionId = 'test-kb-session-' + Date.now();
      
      const response = await agent.processMessage(
        'What products do you sell?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      expect(response.data.message.content).toBeDefined();
      
      // Should contain product information from the external knowledge base
      const content = response.data.message.content.toLowerCase();
      expect(
        content.includes('widget') || 
        content.includes('blue') || 
        content.includes('red') || 
        content.includes('green')
      ).toBe(true);
    });

    it('should retrieve order information from knowledge base', async () => {
      const sessionId = 'test-order-session-' + Date.now();
      
      const response = await agent.processMessage(
        'How long does shipping take for orders?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      expect(response.data.message.content).toBeDefined();
      
      // Should contain shipping information from the knowledge base
      const content = response.data.message.content.toLowerCase();
      expect(
        content.includes('ship') || 
        content.includes('2-3') || 
        content.includes('business days')
      ).toBe(true);
    });
  });

  describe('Database Integration', () => {
    it('should handle customer queries with database context', async () => {
      const sessionId = 'test-db-session-' + Date.now();
      
      const response = await agent.processMessage(
        'I need help with my account information',
        'text',
        sessionId,
        '+15551234567' // User ID that matches mock database
      );

      expect(response.success).toBe(true);
      expect(response.data.message.content).toBeDefined();
      
      // The response should be contextually aware
      // (We can't easily test the exact content without knowing the LLM response,
      //  but we can verify the process completed successfully)
    });
  });

  describe('Context Bridging with External Knowledge', () => {
    it('should work with voice to text modality switching', async () => {
      const sessionId = 'test-bridge-session-' + Date.now();
      
      // Start with voice input
      const voiceResponse = await agent.processMessage(
        'Tell me about your products',
        'voice',
        sessionId
      );

      expect(voiceResponse.success).toBe(true);
      expect(voiceResponse.metadata.modalityUsed).toBe('voice');
      
      // Switch to text - should maintain context including external knowledge
      const textResponse = await agent.processMessage(
        'What colors are available?',
        'text',
        sessionId
      );

      expect(textResponse.success).toBe(true);
      expect(textResponse.metadata.modalityUsed).toBe('text');
      expect(textResponse.metadata.contextBridgeTriggered).toBe(true);
    });

    it('should combine conversation history with external knowledge', async () => {
      const sessionId = 'test-combined-session-' + Date.now();
      
      // First message establishes conversation context
      await agent.processMessage(
        'I am looking for a gift',
        'text',
        sessionId
      );

      // Second message should use both conversation history AND external knowledge
      const response = await agent.processMessage(
        'What products would you recommend?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      expect(response.data.sessionState.totalMessages).toBe(2);
      
      // Should have conversation context plus external product knowledge
      const content = response.data.message.content.toLowerCase();
      expect(content.length).toBeGreaterThan(20); // Should be substantial response
    });
  });

  describe('Event System with Context Providers', () => {
    it('should emit external_context_retrieved event', (done) => {
      const sessionId = 'test-event-session-' + Date.now();
      
      agent.on('external_context_retrieved', (event) => {
        expect(event.sessionId).toBe(sessionId);
        expect(event.data.hasExternalKnowledge).toBe(true);
        expect(event.data.contextSources).toBeGreaterThan(0);
        done();
      });

      agent.processMessage(
        'What products do you have?',
        'text',
        sessionId
      );
    });

    it('should emit context_bridged and external_context_retrieved together', (done) => {
      const sessionId = 'test-multi-event-session-' + Date.now();
      let eventsReceived = [];

      agent.on('context_bridged', (event) => {
        eventsReceived.push('context_bridged');
        checkCompletion();
      });

      agent.on('external_context_retrieved', (event) => {
        eventsReceived.push('external_context_retrieved');
        checkCompletion();
      });

      function checkCompletion() {
        if (eventsReceived.length === 2) {
          expect(eventsReceived).toContain('context_bridged');
          expect(eventsReceived).toContain('external_context_retrieved');
          done();
        }
      }

      // Start with voice, then switch to text to trigger context bridging
      agent.processMessage('Hello', 'voice', sessionId)
        .then(() => {
          return agent.processMessage('What products do you sell?', 'text', sessionId);
        });
    });
  });

  describe('Error Handling', () => {
    it('should continue working when context provider fails', async () => {
      // Create a provider that will fail
      const failingProvider = new KnowledgeBaseProvider({
        id: 'failing-provider',
        name: 'Failing Provider',
        enabled: true,
        priority: 100,
        options: {
          customSearch: async (query) => {
            throw new Error('Provider failure');
          }
        }
      });

      const agentWithFailingProvider = new ContextualAgent({
        name: 'Agent with Failing Provider',
        mode: 'conversation',
        systemPrompt: 'You are a resilient agent.',
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
        },
        contextProviders: [failingProvider]
      });

      const sessionId = 'test-error-session-' + Date.now();
      
      const response = await agentWithFailingProvider.processMessage(
        'Hello there',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      // Should still work even when context provider fails
      
      await agentWithFailingProvider.shutdown();
    });
  });
});