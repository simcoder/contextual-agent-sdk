# 📞 Using Phone Numbers as Session IDs

This guide shows how to use customer phone numbers as session identifiers to maintain conversational context across multiple calls and texts.

## 🎯 Benefits

- **Persistent Context**: Customers can hang up and call back without losing conversation context
- **Cross-Modal Memory**: Switch between voice calls and SMS seamlessly  
- **Customer Recognition**: "Welcome back! I remember our previous conversation"
- **Long-term Relationships**: Context retained for days/weeks (configurable)

## 🏗️ Architecture

```
📱 Customer: +1-555-123-4567
    ↓
🔧 Twilio normalizes to sessionId: "+15551234567"  
    ↓
🤖 ContextualAgent loads/creates session
    ↓
💾 Redis/Database stores conversation history
    ↓
🧠 Context bridging works across calls
```

## ⚡ Quick Setup

### 1. Install Dependencies

```bash
npm install contextual-agent-sdk express twilio redis
```

### 2. Environment Variables

```bash
# .env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_key  # or other LLM provider
```

### 3. Run the Example

```bash
node examples/twilio-phone-session.js
```

### 4. Configure Twilio Webhooks

**Voice Webhook URL**: `https://your-domain.ngrok.io/voice`
**SMS Webhook URL**: `https://your-domain.ngrok.io/sms`

## 🔄 Context Flow Example

### Call 1 (Voice):
```
Customer: "Hi, I'm having trouble with my order #12345"
Agent: "I can help you with that order. What specific issue are you experiencing?"
Customer: "It hasn't shipped yet"
Agent: "Let me check on that for you..." [Call ends]
```

### Call 2 (1 hour later, Voice):
```
Customer: "Hi, it's me again"
Agent: "Welcome back! I remember we were discussing your order #12345 shipping issue. I have an update for you..."
```

### Text Message (Same day):
```
Customer: "Any update on my order?"
Agent: "Hi! Yes, your order #12345 has now shipped and you should receive it tomorrow. Tracking: 1Z999..."
```

## 📊 Session Data Structure

Each phone number session stores:

```javascript
{
  sessionId: "+15551234567",
  userId: "+15551234567", 
  startTime: "2024-01-15T10:30:00Z",
  lastActivity: "2024-01-15T14:22:00Z",
  currentModality: "voice",
  totalMessages: 12,
  context: {
    conversationHistory: [...],
    extractedEntities: {
      "order_number": "12345",
      "customer_name": "John Smith",
      "issue_type": "shipping_delay"
    },
    summary: "Customer John Smith called about shipping delay for order #12345...",
    memory: [
      { type: "fact", content: "Customer prefers SMS updates", confidence: 0.9 },
      { type: "preference", content: "Usually calls during lunch break", confidence: 0.7 }
    ]
  }
}
```

## 🔧 Advanced Features

### Phone Number Normalization
```javascript
function normalizePhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}
```

### Multi-Modal Context Bridging
```javascript
// Customer calls after texting
const response = await agent.processMessage(
  speechInput,
  'voice',           // Target modality  
  sessionId,         // Phone number
  customerPhone      // User ID
);

// SDK automatically bridges context from text → voice
```

### Session Analytics
```javascript
// Get customer interaction history
app.get('/admin/customer/:phone/analytics', async (req, res) => {
  const sessionId = normalizePhoneNumber(req.params.phone);
  const session = await agent.getSession(sessionId);
  
  res.json({
    totalCalls: session.metadata.callCount,
    totalTexts: session.metadata.smsCount,
    avgResponseTime: session.metadata.avgResponseTime,
    satisfactionScore: session.metadata.satisfaction,
    preferredModality: session.currentModality,
    keyTopics: session.context.extractedEntities
  });
});
```

## 💾 Storage Options

### In-Memory (Development)
```javascript
const agent = new ContextualAgent({
  // ... config
  storage: {
    type: 'memory'
  }
});
```

### Redis (Production)
```javascript
const agent = new ContextualAgent({
  // ... config  
  storage: {
    type: 'redis',
    config: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      ttl: 30 * 24 * 60 * 60 // 30 days
    }
  }
});
```

### Database (Enterprise)
```javascript
const agent = new ContextualAgent({
  // ... config
  storage: {
    type: 'database',
    config: {
      connectionString: process.env.DATABASE_URL,
      tableName: 'agent_sessions'
    }
  }
});
```

## 🔒 Privacy & Compliance

### GDPR/CCPA Compliance
```javascript
// Customer requests data deletion
app.delete('/privacy/delete/:phone', async (req, res) => {
  const sessionId = normalizePhoneNumber(req.params.phone);
  await agent.destroySession(sessionId);
  res.json({ message: 'Customer data deleted' });
});

// Data export
app.get('/privacy/export/:phone', async (req, res) => {
  const sessionId = normalizePhoneNumber(req.params.phone);
  const session = await agent.getSession(sessionId);
  res.json(session);
});
```

### Encryption
```javascript
const agent = new ContextualAgent({
  // ... config
  storage: {
    type: 'database',
    config: {
      encryption: true,
      encryptionKey: process.env.ENCRYPTION_KEY
    }
  }
});
```

## 📈 Monitoring & Metrics

```javascript
// Track key metrics
agent.on('session_started', (event) => {
  metrics.increment('sessions.new');
});

agent.on('modality_switched', (event) => {
  metrics.increment('modality.switch', {
    from: event.data.from,
    to: event.data.to
  });
});

agent.on('context_bridged', (event) => {
  metrics.increment('context.bridged');
  metrics.timer('context.bridge_time', event.data.bridgeTime);
});
```

## 🚀 Deployment Tips

1. **Use Redis Cluster** for high availability
2. **Set appropriate TTL** for sessions (7-30 days typical)
3. **Monitor memory usage** for long conversations
4. **Implement rate limiting** per phone number
5. **Log customer interactions** for quality assurance
6. **Use webhooks** for real-time session updates

## 📞 Testing

```bash
# Test voice call
curl -X POST http://localhost:3000/voice \
  -d "From=%2B15551234567" \
  -d "To=%2B15559876543"

# Test SMS  
curl -X POST http://localhost:3000/sms \
  -d "From=%2B15551234567" \
  -d "Body=Hello, I need help"

# Check session
curl http://localhost:3000/admin/session/+15551234567
```

This setup gives you **persistent, intelligent conversations** that remember context across all customer touchpoints! 🎉