// Simple example: Phone number as session ID
// npm install contextual-agent-sdk express twilio

const express = require('express');
const { ContextualAgent } = require('contextual-agent-sdk');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Initialize agent with persistent sessions
const agent = new ContextualAgent({
  name: 'Customer Service AI',
  systemPrompt: 'You are a helpful customer service agent. Remember previous conversations.',
  capabilities: {
    voiceEnabled: true,
    textEnabled: true,
    contextBridging: true,
    memoryRetention: true
  },
  contextSettings: {
    memoryRetentionDays: 30 // Remember customers for 30 days
  }
});

// Normalize phone number for consistent session IDs
function phoneToSessionId(phoneNumber) {
  return phoneNumber.replace(/\D/g, '').replace(/^1/, '+1');
}

// Handle incoming voice calls
app.post('/voice', async (req, res) => {
  const customerPhone = req.body.From;
  const sessionId = phoneToSessionId(customerPhone);
  
  // Check if returning customer
  const existingSession = await agent.getSession(sessionId);
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (existingSession) {
    twiml.say('Welcome back! I remember our previous conversation.');
  } else {
    twiml.say('Hello! How can I help you today?');
  }
  
  twiml.gather({
    input: 'speech',
    action: '/voice/process',
    enhanced: true
  });
  
  res.type('text/xml').send(twiml.toString());
});

// Process voice input
app.post('/voice/process', async (req, res) => {
  const customerPhone = req.body.From;
  const sessionId = phoneToSessionId(customerPhone);
  const speechInput = req.body.SpeechResult;
  
  // Process with context preservation
  const response = await agent.processMessage(
    speechInput,
    'voice',
    sessionId,
    customerPhone
  );
  
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(response.data.message.content);
  
  // Continue conversation
  twiml.gather({
    input: 'speech',
    action: '/voice/process',
    enhanced: true
  });
  
  res.type('text/xml').send(twiml.toString());
});

// Handle SMS messages
app.post('/sms', async (req, res) => {
  const customerPhone = req.body.From;
  const sessionId = phoneToSessionId(customerPhone);
  const messageText = req.body.Body;
  
  // Process with seamless context bridging (voice ↔ text)
  const response = await agent.processMessage(
    messageText,
    'text',
    sessionId,
    customerPhone
  );
  
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(response.data.message.content);
  
  res.type('text/xml').send(twiml.toString());
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
  console.log('📞 Configure Twilio voice webhook: /voice');
  console.log('💬 Configure Twilio SMS webhook: /sms');
});