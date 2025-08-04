// Example: Using Customer Phone Number as Session ID with Twilio
// This maintains context across multiple calls and texts from the same number

const express = require('express');
const { ContextualAgent } = require('contextual-agent-sdk');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Initialize your Contextual Agent
const agent = new ContextualAgent({
  name: 'Customer Service Agent',
  mode: 'conversation',
  systemPrompt: 'You are a helpful customer service representative. Remember previous conversations with customers.',
  capabilities: {
    voiceEnabled: true,
    textEnabled: true,
    contextBridging: true,
    memoryRetention: true,
    emotionRecognition: true,
    taskExecution: true
  },
  contextSettings: {
    maxHistoryLength: 50, // Remember more for phone sessions
    contextWindowSize: 8000,
    relevanceThreshold: 0.7,
    memoryRetentionDays: 30, // Keep customer context for 30 days
    modalitySwitchSensitivity: 0.8
  },
  // Persistent storage for phone sessions
  storage: {
    type: 'redis', // or 'database' for production
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    }
  }
});

/**
 * Normalize phone number to consistent format for session ID
 */
function normalizePhoneNumber(phoneNumber) {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Ensure it starts with country code
  if (digits.length === 10) {
    return `+1${digits}`; // US/Canada
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}

/**
 * VOICE CALLS: Handle incoming voice calls
 */
app.post('/voice', async (req, res) => {
  const customerPhone = req.body.From; // e.g., "+15551234567"
  const sessionId = normalizePhoneNumber(customerPhone);
  
  console.log(`📞 Incoming call from ${customerPhone} (session: ${sessionId})`);
  
  // Check if returning customer
  const existingSession = await agent.getSession(sessionId);
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (existingSession) {
    // Returning customer - acknowledge previous conversation
    twiml.say({
      voice: 'Polly.Joanna'
    }, `Welcome back! I remember our previous conversation. How can I help you today?`);
  } else {
    // New customer
    twiml.say({
      voice: 'Polly.Joanna'
    }, `Hello! I'm your AI assistant. How can I help you today?`);
  }
  
  // Start conversation
  twiml.gather({
    input: 'speech',
    action: '/voice/process',
    method: 'POST',
    speechTimeout: 3,
    enhanced: true
  });
  
  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * VOICE PROCESSING: Handle speech input
 */
app.post('/voice/process', async (req, res) => {
  const customerPhone = req.body.From;
  const speechResult = req.body.SpeechResult || '';
  const sessionId = normalizePhoneNumber(customerPhone);
  
  console.log(`🗣️ Customer said: "${speechResult}"`);
  
  try {
    // Process with context bridging
    const response = await agent.processMessage(
      speechResult,
      'voice', // Target modality
      sessionId,
      customerPhone // User ID
    );
    
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Respond to customer
    twiml.say({
      voice: 'Polly.Joanna'
    }, response.data.message.content);
    
    // Continue conversation or end
    if (response.data.message.content.toLowerCase().includes('goodbye') || 
        response.data.message.content.toLowerCase().includes('that\'s all')) {
      twiml.say({
        voice: 'Polly.Joanna'
      }, 'Thank you for calling! Have a great day!');
      twiml.hangup();
    } else {
      // Keep listening
      twiml.gather({
        input: 'speech',
        action: '/voice/process',
        method: 'POST',
        speechTimeout: 3,
        enhanced: true
      });
      
      twiml.say({
        voice: 'Polly.Joanna'
      }, 'Is there anything else I can help you with?');
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    console.error('Error processing voice:', error);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: 'Polly.Joanna'
    }, 'I apologize, I had trouble understanding. Could you please repeat that?');
    
    twiml.gather({
      input: 'speech',
      action: '/voice/process',
      method: 'POST',
      speechTimeout: 3,
      enhanced: true
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

/**
 * SMS: Handle incoming text messages
 */
app.post('/sms', async (req, res) => {
  const customerPhone = req.body.From;
  const messageBody = req.body.Body || '';
  const sessionId = normalizePhoneNumber(customerPhone);
  
  console.log(`💬 SMS from ${customerPhone}: "${messageBody}"`);
  
  try {
    // Process with context bridging (voice ↔ text seamlessly)
    const response = await agent.processMessage(
      messageBody,
      'text', // Target modality
      sessionId,
      customerPhone
    );
    
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(response.data.message.content);
    
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    console.error('Error processing SMS:', error);
    
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('I apologize, I had trouble processing your message. Could you please try again?');
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

/**
 * STATUS WEBHOOK: Track call/message status
 */
app.post('/status', (req, res) => {
  const customerPhone = req.body.From;
  const status = req.body.CallStatus || req.body.MessageStatus;
  
  console.log(`📊 Status update from ${customerPhone}: ${status}`);
  
  // You could track metrics, update session metadata, etc.
  
  res.sendStatus(200);
});

/**
 * ADMIN: Get session info for debugging
 */
app.get('/admin/session/:phone', async (req, res) => {
  const sessionId = normalizePhoneNumber(req.params.phone);
  
  try {
    const session = await agent.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      sessionId,
      totalMessages: session.totalMessages,
      lastActivity: session.lastActivity,
      currentModality: session.currentModality,
      conversationSummary: session.context.summary,
      recentMessages: session.context.conversationHistory.slice(-5)
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners for monitoring
agent.on('session_started', (event) => {
  console.log(`🆕 New session started: ${event.sessionId}`);
});

agent.on('modality_switched', (event) => {
  console.log(`🔄 Modality switch in ${event.sessionId}: ${event.data.from} → ${event.data.to}`);
});

agent.on('context_bridged', (event) => {
  console.log(`🌉 Context bridged in ${event.sessionId}: ${event.data.bridgeType}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Contextual Agent Twilio server running on port ${PORT}`);
  console.log(`📞 Voice webhook: http://localhost:${PORT}/voice`);
  console.log(`💬 SMS webhook: http://localhost:${PORT}/sms`);
});

module.exports = app;