// Integration test for Context Providers with External Knowledge Sources
// Run with: npm test

const { ContextualAgent } = require('../../dist/index.js');
const { KnowledgeBaseProvider } = require('../../dist/providers/KnowledgeBaseProvider.js');
const { DatabaseContextProvider } = require('../../dist/providers/DatabaseContextProvider.js');
const fs = require('fs');
const path = require('path');

describe('Context Providers Integration Test', () => {
  let agent;
  let testDataDir;
  let testDocs;

  beforeAll(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, 'test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Create test documentation files
    testDocs = {
      'products.md': `# Product Catalog

## Widgets
- **Blue Widget**: $19.99 - High-quality blue widget with premium features
- **Red Widget**: $24.99 - Professional red widget for business use  
- **Green Widget**: $29.99 - Eco-friendly green widget, made from recycled materials

## Accessories
- Widget Stand: $9.99
- Widget Cover: $4.99
- Widget Cleaner: $2.99

## Shipping Information
All orders ship within 1-2 business days via FedEx or UPS.
Free shipping on orders over $50.`,

      'support.md': `# Customer Support Guide

## Troubleshooting
**Widget not working?**
1. Check power connection
2. Restart the device
3. Update firmware if available

**Shipping Issues**
- Orders typically arrive within 3-5 business days
- Track your order using the tracking number provided
- Contact support for delivery issues

## Returns
- 30-day return policy
- Items must be in original condition
- Free return shipping for defective items`,

      'company-info.json': JSON.stringify({
        name: "Widget World",
        founded: 2020,
        location: "San Francisco, CA",
        contact: {
          phone: "1-800-WIDGETS",
          email: "support@widgetworld.com",
          hours: "Mon-Fri 9AM-6PM PST"
        },
        services: [
          "Widget Sales",
          "Technical Support", 
          "Custom Widget Design"
        ]
      }, null, 2)
    };

    // Write test files
    for (const [filename, content] of Object.entries(testDocs)) {
      fs.writeFileSync(path.join(testDataDir, filename), content);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Could not cleanup test data:', error.message);
    }

    if (agent) {
      await agent.shutdown();
    }
  });

  beforeEach(() => {
    // Create knowledge base provider with real files
    const knowledgeProvider = new KnowledgeBaseProvider({
      id: 'file-knowledge',
      name: 'File-based Knowledge Base',
      enabled: true,
      priority: 90,
      options: {
        sources: [
          {
            type: 'file',
            path: path.join(testDataDir, 'products.md'),
            format: 'markdown',
            weight: 1.0,
            tags: ['products', 'catalog']
          },
          {
            type: 'file', 
            path: path.join(testDataDir, 'support.md'),
            format: 'markdown',
            weight: 0.9,
            tags: ['support', 'help']
          },
          {
            type: 'file',
            path: path.join(testDataDir, 'company-info.json'),
            format: 'json',
            weight: 0.8,
            tags: ['company', 'contact']
          }
        ],
        searchType: 'fuzzy',
        maxResults: 3
      }
    });

    // Create mock database provider with realistic data
    const databaseProvider = new DatabaseContextProvider({
      id: 'customer-database',
      name: 'Customer Database',
      enabled: true,
      priority: 85,
      config: {
        type: 'mock',
        queries: {
          customer_lookup: 'SELECT * FROM customers WHERE phone = ?',
          order_history: 'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_date DESC LIMIT 5',
          inventory_check: 'SELECT * FROM inventory WHERE product_name LIKE ?'
        }
      },
      executeQuery: async (query, params) => {
        // Simulate realistic database responses
        if (query.includes('customers')) {
          const phone = params[0];
          if (phone === '+15551234567') {
            return [{
              customer_id: 1001,
              name: 'Alice Johnson',
              phone: '+15551234567',
              email: 'alice@example.com',
              membership_level: 'Premium',
              join_date: '2023-01-15',
              total_orders: 12,
              total_spent: 489.99
            }];
          } else if (phone === '+15559876543') {
            return [{
              customer_id: 1002,
              name: 'Bob Smith', 
              phone: '+15559876543',
              email: 'bob@example.com',
              membership_level: 'Standard',
              join_date: '2023-06-22',
              total_orders: 3,
              total_spent: 127.45
            }];
          }
        }

        if (query.includes('orders')) {
          const phone = params[0];
          if (phone === '+15551234567') {
            return [
              {
                order_id: 'WW-2024-001',
                product: 'Blue Widget',
                quantity: 2,
                total: 39.98,
                status: 'Delivered',
                tracking: '1Z999AA1234567890',
                created_date: '2024-01-10'
              },
              {
                order_id: 'WW-2024-015',
                product: 'Widget Stand',
                quantity: 1,
                total: 9.99,
                status: 'Shipped',
                tracking: '1Z999BB9876543210',
                created_date: '2024-01-08'
              }
            ];
          }
        }

        if (query.includes('inventory')) {
          const product = params[0];
          if (product.toLowerCase().includes('blue')) {
            return [{
              product_id: 'WGT-001',
              product_name: 'Blue Widget',
              price: 19.99,
              stock_quantity: 150,
              category: 'Widgets',
              last_updated: '2024-01-15'
            }];
          }
        }

        return [];
      }
    });

    // Initialize agent with realistic configuration
    agent = new ContextualAgent({
      name: 'Widget World Customer Service Agent',
      mode: 'conversation',
      systemPrompt: 'You are a helpful customer service agent for Widget World. Use the available information to provide accurate and helpful responses to customers.',
      capabilities: {
        voiceEnabled: true,
        textEnabled: true,
        contextBridging: true,
        memoryRetention: true,
        emotionRecognition: false,
        taskExecution: false
      },
      contextSettings: {
        maxHistoryLength: 15,
        contextWindowSize: 6000,
        relevanceThreshold: 0.6,
        memoryRetentionDays: 30,
        modalitySwitchSensitivity: 0.8
      },
      contextProviders: [knowledgeProvider, databaseProvider]
    });
  });

  describe('Real-world Knowledge Base Scenarios', () => {
    it('should answer product questions using markdown documentation', async () => {
      const sessionId = 'product-inquiry-' + Date.now();
      
      const response = await agent.processMessage(
        'What widgets do you sell and how much do they cost?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      
      const content = response.data.message.content.toLowerCase();
      // Should contain product information from products.md
      expect(content).toMatch(/blue|red|green/);
      expect(content).toMatch(/19\.99|24\.99|29\.99/);
    });

    it('should provide support information from documentation', async () => {
      const sessionId = 'support-inquiry-' + Date.now();
      
      const response = await agent.processMessage(
        'My widget is not working, what should I do?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      
      const content = response.data.message.content.toLowerCase();
      // Should contain troubleshooting steps from support.md
      expect(content).toMatch(/power|connection|restart|firmware/);
    });

    it('should provide company information from JSON file', async () => {
      const sessionId = 'company-inquiry-' + Date.now();
      
      const response = await agent.processMessage(
        'What are your business hours and how can I contact you?',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      
      const content = response.data.message.content.toLowerCase();
      // Should contain company info from company-info.json
      expect(content).toMatch(/mon-fri|9am|6pm|800-widgets/);
    });
  });

  describe('Customer Database Integration', () => {
    it('should provide personalized service for known customers', async () => {
      const sessionId = 'customer-service-' + Date.now();
      const customerId = '+15551234567'; // Alice Johnson in mock DB
      
      const response = await agent.processMessage(
        'Hi, I need help with my account',
        'text',
        sessionId,
        customerId
      );

      expect(response.success).toBe(true);
      
      // The response should be personalized, though we can't predict exact content
      expect(response.data.message.content.length).toBeGreaterThan(20);
    });

    it('should handle order history inquiries', async () => {
      const sessionId = 'order-history-' + Date.now();
      const customerId = '+15551234567';
      
      const response = await agent.processMessage(
        'Can you tell me about my recent orders?',
        'text',
        sessionId,
        customerId
      );

      expect(response.success).toBe(true);
      
      const content = response.data.message.content.toLowerCase();
      // Should reference order information from database
      expect(content).toMatch(/order|blue widget|delivered|shipped/);
    });
  });

  describe('Multi-source Context Integration', () => {
    it('should combine knowledge base and database information', async () => {
      const sessionId = 'multi-source-' + Date.now();
      const customerId = '+15551234567';
      
      // First establish customer context
      await agent.processMessage(
        'Hello, I am an existing customer',
        'text',
        sessionId,
        customerId
      );

      // Then ask a question that requires both product knowledge and customer data
      const response = await agent.processMessage(
        'I want to order another blue widget like my last purchase. What is the current price?',
        'text',
        sessionId,
        customerId
      );

      expect(response.success).toBe(true);
      
      const content = response.data.message.content.toLowerCase();
      // Should combine customer order history with current product pricing
      expect(content).toMatch(/blue widget/);
      expect(content).toMatch(/19\.99|\$19/);
    });

    it('should work across voice and text modalities', async () => {
      const sessionId = 'cross-modal-' + Date.now();
      const customerId = '+15559876543';
      
      // Start with voice inquiry
      const voiceResponse = await agent.processMessage(
        'I am having trouble with my recent order',
        'voice',
        sessionId,
        customerId
      );

      expect(voiceResponse.success).toBe(true);
      expect(voiceResponse.metadata.modalityUsed).toBe('voice');
      
      // Continue with text - should bridge context including external knowledge
      const textResponse = await agent.processMessage(
        'Can you check my order status?',
        'text',
        sessionId,
        customerId
      );

      expect(textResponse.success).toBe(true);
      expect(textResponse.metadata.modalityUsed).toBe('text');
      expect(textResponse.metadata.contextBridgeTriggered).toBe(true);
    });
  });

  describe('Context Provider Performance', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 5; i++) {
        requests.push(
          agent.processMessage(
            `Tell me about your products - request ${i}`,
            'text',
            `concurrent-session-${i}-${Date.now()}`,
            `+155512345${i}7`
          )
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.success).toBe(true);
        expect(response.data.message.content).toBeDefined();
      });
    });

    it('should cache document results for performance', async () => {
      const sessionId = 'caching-test-' + Date.now();
      
      const start1 = Date.now();
      const response1 = await agent.processMessage(
        'What products do you sell?',
        'text',
        sessionId
      );
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const response2 = await agent.processMessage(
        'Tell me more about your widget products',
        'text',
        sessionId
      );
      const time2 = Date.now() - start2;

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      
      // Second request should be faster due to caching (though this is not guaranteed)
      console.log(`First request: ${time1}ms, Second request: ${time2}ms`);
    });
  });

  describe('Error Recovery', () => {
    it('should gracefully handle missing files', async () => {
      // Create provider with non-existent file
      const badProvider = new KnowledgeBaseProvider({
        id: 'bad-provider',
        name: 'Bad Provider',
        enabled: true,
        priority: 100,
        options: {
          sources: [
            {
              type: 'file',
              path: '/non/existent/file.md',
              format: 'markdown'
            }
          ]
        }
      });

      const agentWithBadProvider = new ContextualAgent({
        name: 'Agent with Bad Provider',
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
        contextProviders: [badProvider]
      });

      const sessionId = 'error-recovery-' + Date.now();
      
      const response = await agentWithBadProvider.processMessage(
        'Hello there',
        'text',
        sessionId
      );

      expect(response.success).toBe(true);
      
      await agentWithBadProvider.shutdown();
    });
  });
});