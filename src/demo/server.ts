import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ContextualAgent, AgentConfig, AgentEvent } from '../index';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('src/demo/public'));

// Initialize the Contextual Agent with demo configuration
const agentConfig: AgentConfig = {
  name: 'Demo Contextual Agent',
  mode: 'conversation',
  systemPrompt: 'You are a helpful AI assistant that can seamlessly switch between voice and text conversations. Adapt your response style based on the interaction modality.',
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

// Initialize agent with OpenAI API key if available
const agent = new ContextualAgent(agentConfig, process.env.OPENAI_API_KEY);

// Event logging for demo purposes
agent.on('session_started', (event: AgentEvent) => {
  console.log('🎬 Session started:', event.sessionId);
});

agent.on('modality_switched', (event: AgentEvent) => {
  console.log('🔄 Modality switched:', event.data);
});

agent.on('context_bridged', (event: AgentEvent) => {
  console.log('🌉 Context bridged:', event.data);
});

agent.on('error_occurred', (event: AgentEvent) => {
  console.error('❌ Error:', event.data);
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    capabilities: agent.getCapabilities(),
    timestamp: new Date().toISOString()
  });
});

// Text message endpoint
app.post('/chat/text', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;

    if (!message || !sessionId) {
      res.status(400).json({
        error: 'Missing required fields: message, sessionId'
      });
      return;
    }

    console.log(`💬 Text message from ${sessionId}: "${message}"`);

    const response = await agent.processMessage(
      message,
      'text',
      sessionId,
      userId
    );

    res.json(response);
  } catch (error) {
    console.error('Text processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        recoverable: true
      }
    });
  }
});

// Voice message endpoint (simulated)
app.post('/chat/voice', async (req, res) => {
  try {
    const { audioData, sessionId, userId } = req.body;

    if (!audioData || !sessionId) {
      res.status(400).json({
        error: 'Missing required fields: audioData, sessionId'
      });
      return;
    }

    console.log(`🎤 Voice message from ${sessionId}`);

    // For demo purposes, we'll simulate voice input
    const simulatedVoiceInput = {
      type: 'audio',
      audioData: audioData,
      mimeType: 'audio/wav'
    };

    const response = await agent.processMessage(
      simulatedVoiceInput,
      'voice',
      sessionId,
      userId
    );

    res.json(response);
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        recoverable: true
      }
    });
  }
});

// Switch modality endpoint - THE KEY INNOVATION DEMO
app.post('/chat/switch', async (req, res) => {
  try {
    const { targetModality, sessionId } = req.body;

    if (!targetModality || !sessionId) {
      res.status(400).json({
        error: 'Missing required fields: targetModality, sessionId'
      });
      return;
    }

    if (!['voice', 'text'].includes(targetModality)) {
      res.status(400).json({
        error: 'Invalid targetModality. Must be "voice" or "text"'
      });
      return;
    }

    console.log(`🔄 Switching to ${targetModality} for session ${sessionId}`);

    const response = await agent.switchModality(targetModality, sessionId);

    res.json(response);
  } catch (error) {
    console.error('Modality switch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        recoverable: true
      }
    });
  }
});

// Get session information
app.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await agent.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Session not found'
      });
      return;
    }

    const summary = await agent.getConversationSummary(sessionId);
    res.json({
      session,
      summary
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete session
app.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await agent.destroySession(sessionId);

    if (success) {
      console.log(`🗑️ Session ${sessionId} destroyed`);
      res.json({ success: true, message: 'Session destroyed' });
    } else {
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  } catch (error) {
    console.error('Session deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Demo conversation endpoint - shows context bridging in action
app.post('/demo/conversation', async (req, res) => {
  try {
    const sessionId = `demo_${Date.now()}`;
    const conversation = [];

    console.log(`🎭 Starting demo conversation: ${sessionId}`);

    // Step 1: Start with text
    console.log('📝 Step 1: Text interaction');
    const textResponse = await agent.processMessage(
      'Hello, I need help with my order',
      'text',
      sessionId
    );
    conversation.push({
      step: 1,
      input: 'Hello, I need help with my order',
      modality: 'text',
      response: textResponse.data?.message.content
    });

    // Step 2: Switch to voice - THIS IS THE KEY INNOVATION
    console.log('🎤 Step 2: Switching to voice with context bridging');
    const voiceResponse = await agent.switchModality('voice', sessionId);
    conversation.push({
      step: 2,
      action: 'modality_switch',
      targetModality: 'voice',
      contextBridged: voiceResponse.metadata.contextBridgeTriggered,
      response: voiceResponse.data?.message.content
    });

    // Step 3: Continue voice conversation
    console.log('🗣️ Step 3: Continue voice conversation');
    const voiceInput = {
      type: 'audio',
      transcription: 'My order number is 12345 and it hasn\'t arrived yet'
    };
    const voiceContinue = await agent.processMessage(
      voiceInput,
      'voice',
      sessionId
    );
    conversation.push({
      step: 3,
      input: 'My order number is 12345 and it hasn\'t arrived yet',
      modality: 'voice',
      response: voiceContinue.data?.message.content
    });

    // Step 4: Switch back to text
    console.log('💬 Step 4: Switch back to text');
    const textSwitchResponse = await agent.switchModality('text', sessionId);
    conversation.push({
      step: 4,
      action: 'modality_switch',
      targetModality: 'text',
      contextBridged: textSwitchResponse.metadata.contextBridgeTriggered,
      response: textSwitchResponse.data?.message.content
    });

    // Get final session state
    const finalSession = await agent.getSession(sessionId);
    const conversationSummary = await agent.getConversationSummary(sessionId);

    res.json({
      success: true,
      sessionId,
      conversation,
      sessionStats: {
        totalMessages: finalSession?.totalMessages,
        modalitySwitches: finalSession?.metadata.modalitySwitches,
        conversationSummary
      },
      innovation: {
        description: 'This demo shows seamless context bridging between voice and text modalities',
        keyFeatures: [
          'Automatic modality detection',
          'Context preservation during switches',
          'Modality-appropriate response formatting',
          'Session state management',
          'Real-time conversation flow tracking'
        ]
      }
    });

    // Clean up demo session
    setTimeout(async () => {
      await agent.destroySession(sessionId);
    }, 30000); // Clean up after 30 seconds

  } catch (error) {
    console.error('Demo conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Demo conversation failed'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await agent.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await agent.shutdown();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`
🚀 Contextual Agent SDK Demo Server
📡 Server running on port ${port}
🌐 Health check: http://localhost:${port}/health
📚 Demo conversation: POST http://localhost:${port}/demo/conversation

🔧 Available endpoints:
   POST /chat/text - Send text message
   POST /chat/voice - Send voice message (simulated)
   POST /chat/switch - Switch modality (THE KEY INNOVATION)
   GET  /session/:id - Get session info
   DELETE /session/:id - Delete session

💡 Try the demo conversation to see context bridging in action!
  `);
});

export default app; 