# Contextual Agent SDK

[![npm version](https://badge.fury.io/js/contextual-agent-sdk.svg)](https://badge.fury.io/js/contextual-agent-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/contextual-agent-sdk.svg)](https://npmjs.com/package/contextual-agent-sdk)

A powerful SDK for building AI agents with **seamless voice-text context switching** capabilities. Enable your agents to maintain conversation context when switching between voice and text modalities.

## 🚀 **Key Features**

### **Core Capabilities**
- 🔄 **Seamless Voice-Text Context Switching** - The main innovation
- 🤖 **Multi-LLM Support** - OpenAI, Anthropic, Ollama, Google, Azure, Custom APIs
- 🧠 **Intelligent Context Management** - Pluggable context providers with auto-discovery
- 💾 **Persistent Session Management** - Redis, MongoDB, or in-memory storage
- 🎙️ **Configurable Speech Integration** - STT/TTS with multiple provider support
- 📝 **Auto-Documentation Discovery** - README, docs, changelogs automatically indexed
- ⚡ **Event-Driven Architecture** - Real-time monitoring and analytics
- 🔧 **TypeScript First** - Full type safety and IntelliSense support

### **Production Ready**
- 🏗️ **Modular Architecture** - Use only what you need
- 🔐 **Secure by Default** - Environment-based configuration
- 📊 **Performance Monitoring** - Built-in metrics and analytics
- 🛡️ **Error Handling** - Graceful fallbacks and retry mechanisms
- 🧪 **Comprehensive Testing** - Unit and integration tests included
- 📚 **Rich Documentation** - Examples, guides, and API reference

## 🎯 The Innovation: Context Bridging

**The Problem**: Traditional AI agents lose context when switching between voice and text interactions.

**Our Solution**: Intelligent context bridging that preserves conversation state and adapts responses for different modalities.

```typescript
// Start conversation via text
await agent.processMessage('I need help with order #12345', 'text', 'session-123');

// 🔄 THE MAGIC: Switch to voice mid-conversation
await agent.switchModality('voice', 'session-123');
// Agent responds: "I see you're asking about order 12345. Let me help you with that..."

// Continue seamlessly with voice
const audioFile = new File([audioBuffer], 'voice.wav');
await agent.processMessage(audioFile, 'voice', 'session-123');
```

## 📦 Installation

```bash
npm install contextual-agent-sdk
```

## 🚀 Quick Start

### Basic Setup
```typescript
import { ContextualAgent } from 'contextual-agent-sdk';

const agent = new ContextualAgent({
  name: 'Support Agent',
  systemPrompt: 'You are a helpful customer support agent.',
  llm: {
    providers: {
      'openai': {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY
      }
    },
    defaultProvider: 'openai'
  }
});

// Text interaction
const response = await agent.processMessage(
  'Hello, I need help',
  'text',
  'session-123'
);

console.log(response.data.message.content);
```

### Advanced Setup with All Features
```typescript
import { 
  ContextualAgent, 
  KnowledgeBaseProvider, 
  DatabaseContextProvider 
} from 'contextual-agent-sdk';

// 1. Setup context providers
const knowledgeBase = new KnowledgeBaseProvider({
  id: 'docs',
  name: 'Documentation',
  priority: 90,
  options: {
    autoDiscoverDocs: {
      enabled: true,
      rootPath: process.cwd(),
      patterns: ['README.md', 'docs/**/*.md']
    }
  }
});

const database = new DatabaseContextProvider({
  id: 'user_data',
  name: 'User Database',
  priority: 80,
  connection: {
    type: 'custom',
    customQuery: async (query) => {
      // Your database logic
      return { preferences: {}, history: [] };
    }
  }
});

// 2. Setup speech providers
const speechToText = {
  async transcribe(audioInput, options) {
    // OpenAI Whisper implementation
    const formData = new FormData();
    formData.append('file', audioInput);
    formData.append('model', options?.model || 'whisper-1');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData
    });
    
    return await response.json();
  }
};

// 3. Create agent with full configuration
const agent = new ContextualAgent({
  name: 'Advanced Support Agent',
  systemPrompt: 'You are an intelligent support agent with access to documentation and user data.',
  
  // Multi-LLM setup with fallback
  llm: {
    providers: {
      'openai': { type: 'openai', apiKey: process.env.OPENAI_API_KEY },
      'anthropic': { type: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY },
      'ollama': { type: 'ollama', baseURL: 'http://localhost:11434' }
    },
    defaultProvider: 'openai',
    fallbackProvider: 'ollama'
  },
  
  // Context management
  contextManager: {
    providers: [knowledgeBase, database]
  },
  
  // Speech capabilities
  modalityRouter: {
    speechToText,
    defaultSTTOptions: {
      language: 'en-US',
      model: 'whisper-1'
    }
  },
  
  // Persistent storage
  storage: {
    type: 'redis',
    config: { url: process.env.REDIS_URL }
  }
});

// 4. Use the agent
const textResponse = await agent.processMessage(
  'What are the installation steps?',
  'text',
  'session-123'
);

// 5. Switch to voice seamlessly
const voiceResponse = await agent.switchModality('voice', 'session-123');

// 6. Process voice input
const audioFile = new File([audioBuffer], 'question.wav');
const voiceReply = await agent.processMessage(audioFile, 'voice', 'session-123');
```

## 🧠 Context Management

### Auto-Discovery of Documentation
```typescript
const docsProvider = new KnowledgeBaseProvider({
  id: 'project_docs',
  options: {
    autoDiscoverDocs: {
      enabled: true,
      patterns: [
        'README.md', 'CHANGELOG.md', 'LICENSE',
        'docs/**/*.md', 'api/**/*.json'
      ]
    }
  }
});

// Automatically indexes:
// ✅ README files
// ✅ Documentation folders  
// ✅ API specifications
// ✅ Changelog and contributing guides
// ✅ License information
```

### Custom Context Providers
```typescript
class CRMProvider implements ContextProvider {
  async getContext(params) {
    const customer = await crm.getCustomer(params.userId);
    return {
      content: {
        tier: customer.tier,
        tickets: customer.openTickets,
        satisfaction: customer.satisfactionScore
      },
      metadata: {
        source: 'crm',
        timestamp: new Date()
      }
    };
  }
}
```

## 🎙️ Speech Integration

### Multiple STT/TTS Providers
```typescript
// OpenAI Whisper + TTS
const openaiSpeech = {
  speechToText: whisperProvider,
  textToSpeech: openaiTTSProvider
};

// Google Cloud Speech
const googleSpeech = {
  speechToText: googleSTTProvider,
  textToSpeech: googleTTSProvider
};

// AWS Transcribe + Polly
const awsSpeech = {
  speechToText: transcribeProvider,
  textToSpeech: pollyProvider
};

// Mix and match
const agent = new ContextualAgent({
  modalityRouter: {
    speechToText: googleSTTProvider,  // Google for STT
    textToSpeech: openaiTTSProvider,  // OpenAI for TTS
    defaultSTTOptions: {
      language: 'en-US',
      model: 'latest_long'
    }
  }
});
```

## 🤖 Multi-LLM Support

### Provider Management
```typescript
const agent = new ContextualAgent({
  llm: {
    providers: {
      'primary': { type: 'openai', apiKey: '...' },
      'backup': { type: 'anthropic', apiKey: '...' },
      'local': { type: 'ollama', baseURL: 'http://localhost:11434' },
      'custom': { type: 'custom', baseURL: 'https://my-llm-api.com' }
    },
    defaultProvider: 'primary',
    fallbackProvider: 'backup'
  }
});

// Runtime provider management
agent.addLLMProvider('new-provider', { type: 'openai', apiKey: '...' });
agent.setDefaultLLMProvider('new-provider');

// Test providers
const status = await agent.testLLMProvider('primary');
console.log(status.success); // true/false
```

## 💾 Session Storage

### Multiple Storage Options
```typescript
// Redis (Production)
const agent = new ContextualAgent({
  storage: {
    type: 'redis',
    config: {
      url: process.env.REDIS_URL,
      ssl: true,
      maxConnections: 10
    }
  }
});

// MongoDB (Document Storage)
const agent = new ContextualAgent({
  storage: {
    type: 'mongodb',
    config: {
      url: process.env.MONGODB_URL,
      ssl: true
    }
  }
});

// Memory (Development)
const agent = new ContextualAgent({
  storage: { type: 'memory' }
});
```

## 📊 Event System & Monitoring

### Real-time Event Monitoring
```typescript
// Session events
agent.on('session_started', (event) => {
  console.log(`New session: ${event.sessionId}`);
});

// Context switching events
agent.on('modality_switched', (event) => {
  console.log(`Switched from ${event.data.from} to ${event.data.to}`);
});

// Context bridging events
agent.on('context_bridged', (event) => {
  console.log(`Context bridged: ${event.data.bridgeType}`);
});

// Performance monitoring
agent.on('performance_metric', (event) => {
  console.log(`Response time: ${event.data.responseTime}ms`);
});

// Error handling
agent.on('error_occurred', (event) => {
  console.error(`Error in session ${event.sessionId}:`, event.data.error);
});
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```bash
# LLM Providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-key
OLLAMA_HOST=http://localhost:11434

# Speech Services
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=your-region
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
ASSEMBLYAI_API_KEY=your-assemblyai-key
DEEPGRAM_API_KEY=your-deepgram-key

# Storage
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/agents

# Defaults
DEFAULT_LLM_PROVIDER=openai
DEFAULT_STT_LANGUAGE=en-US
DEFAULT_TTS_VOICE=alloy
```

### TypeScript Configuration
```typescript
interface AgentConfig {
  name: string;
  systemPrompt: string;
  llm?: LLMConfig;
  contextManager?: ContextManagerConfig;
  modalityRouter?: ModalityRouterConfig;
  storage?: StorageConfig;
}
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ContextualAgent │────│ SessionManager  │────│  StorageProvider│
│                 │    │                 │    │  (Redis/Mongo)  │
│ Main SDK Class  │    │ Session & State │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ModalityRouter  │    │ ContextManager  │    │   LLMManager    │
│                 │    │                 │    │                 │
│ Voice/Text      │    │ Context Bridge  │    │ Multi-Provider  │
│ Processing      │    │ & Providers     │    │ Management      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:core
npm run test:integration

# Run with coverage
npm run test:coverage

# Validate setup
npm run validate-setup
```

## 📚 Examples & Demos

```bash
# Basic multi-LLM demo
npm run demo:multi-llm

# Investor presentation demo
npm run demo:investor

# Interactive HTTP server
npm run demo
```

## 🔗 Use Cases

### Customer Support
```typescript
const supportAgent = new ContextualAgent({
  systemPrompt: 'You are a customer support agent with access to user data and documentation.',
  contextManager: {
    providers: [
      new DatabaseContextProvider({ /* CRM integration */ }),
      new KnowledgeBaseProvider({ /* FAQ & docs */ })
    ]
  }
});

// Handle support tickets across voice and text
```

### Educational Assistant
```typescript
const tutorAgent = new ContextualAgent({
  systemPrompt: 'You are an educational assistant helping students learn.',
  contextManager: {
    providers: [
      new KnowledgeBaseProvider({ /* Curriculum content */ }),
      new DatabaseContextProvider({ /* Student progress */ })
    ]
  }
});

// Seamless transition from reading materials to voice Q&A
```

### Code Assistant
```typescript
const codeAgent = new ContextualAgent({
  contextManager: {
    providers: [
      new KnowledgeBaseProvider({
        options: {
          autoDiscoverDocs: {
            enabled: true,
            patterns: ['**/*.md', 'src/**/*.ts', 'docs/**/*']
          }
        }
      })
    ]
  }
});

// Code review via text, explanations via voice
```

## 🚀 Production Deployment

### Docker Setup
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  agent:
    build: .
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License & Attribution

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🏷️ Attribution Requirements

If you use this SDK in your project, please provide attribution to **simcoder technologies a subsidiary of SCS Group** as the creator. You can do this in one of the following ways:

#### **In Your Application:**
```html
<!-- In your app footer or about section -->
Powered by <a href="https://github.com/simcoder/contextual-agent-sdk">Contextual Agent SDK</a> by simcoder technologies
```

#### **In Your README:**
```markdown
## Credits
- Uses [Contextual Agent SDK](https://github.com/simcoder/contextual-agent-sdk) by simcoder technologies for seamless voice-text AI interactions
```

#### **In Package.json:**
```json
{
  "credits": {
    "contextual-agent-sdk": "simcoder technologies - https://github.com/simcoder/contextual-agent-sdk"
  }
}
```

#### **Programmatic Attribution (Easy Way):**
```typescript
import { getAttribution, getHTMLAttribution, logAttribution } from 'contextual-agent-sdk';

// Get attribution info
const attribution = getAttribution();
console.log(attribution.author); // "simcoder technologies a subsidiary of SCS Group"

// Generate HTML for your app
const htmlCredit = getHTMLAttribution();
// Returns: "Powered by <a href="...">Contextual Agent SDK</a> by simcoder technologies"

// Log attribution during development
logAttribution(); // Shows attribution info in console

// For React/Vue components
function AboutPage() {
  const attribution = getAttribution();
  return (
    <div>
      <p>This app uses {attribution.library} by simcoder technologies</p>
      <a href={attribution.url}>Learn more about the technology</a>
    </div>
  );
}
```

### 🙏 Why Attribution Matters

This SDK represents significant innovation in AI agent technology. Attribution helps:
- ✅ Give credit where credit is due
- ✅ Help others discover this technology
- ✅ Support continued development and improvement
- ✅ Build a community around the innovation

**Thank you for using Contextual Agent SDK responsibly!**

---

## 🌟 Why Choose Contextual Agent SDK?

- ✅ **First SDK** to solve seamless voice-text context switching
- ✅ **Production Ready** with enterprise-grade features
- ✅ **Provider Agnostic** - use any LLM or speech service
- ✅ **TypeScript First** - full type safety and great DX
- ✅ **Modular Design** - use only what you need
- ✅ **Comprehensive Documentation** - examples and guides
- ✅ **Active Development** - regular updates and improvements

**Ready to build the future of conversational AI?** Get started with Contextual Agent SDK today! 

## 📊 **Monitoring & Analytics**

### **For SDK Publishers (simcoder technologies)**

Track the usage and adoption of your SDK with these tools:

#### **📈 NPM Download Analytics**

1. **NPM Download Counts API**:
   ```bash
   # Get daily downloads
   curl https://api.npmjs.org/downloads/point/last-day/contextual-agent-sdk
   
   # Get weekly downloads  
   curl https://api.npmjs.org/downloads/point/last-week/contextual-agent-sdk
   
   # Get monthly downloads
   curl https://api.npmjs.org/downloads/point/last-month/contextual-agent-sdk
   
   # Get historical data
   curl https://api.npmjs.org/downloads/range/2024-01-01:2024-12-31/contextual-agent-sdk
   ```

2. **Third-Party Analytics Tools**:
   - **[npm-stat.com](https://npm-stat.com)** - Historical download statistics
   - **[npmtrends.com](https://npmtrends.com)** - Compare download trends
   - **[pkgstats.com](https://pkgstats.com)** - Package discovery and stats
   - **npm-pack-count** - Automated download tracking

#### **🔍 GitHub Repository Analytics**

1. **Built-in GitHub Insights**:
   - **Repository > Insights > Traffic** (14-day data retention)
   - **Stars history** and **Fork tracking**
   - **Clone statistics** and **Visitor analytics**

2. **Extended Analytics Tools**:
   - **[YHYPE](https://yhype.me)** - Extended GitHub analytics (>14 days)
   - **[OSS Insight](https://ossinsight.io)** - Deep repository insights
   - **[GitHub Traffic Dashboard](https://roman-tsisyk.com/GitHub-Traffic-Analysis-Tool/)** - Custom traffic analytics
   - **[u8views.com](https://u8views.com)** - Profile view tracking

3. **Profile View Tracking**:
   ```markdown
   <!-- Add to your GitHub profile README -->
   ![Profile Views](https://u8views.com/api/v1/github/profiles/YOUR-USER-ID/views/day-week-month-total-count.svg)
   ```

#### **⚖️ Attribution Compliance Monitoring**

1. **Automated License Scanning**:
   - **[SCANOSS](https://scanoss.com)** - 100% open source SCA tool
   - **[FOSSology](https://fossology.github.io)** - License compliance toolkit
   - **[ScanCode](https://aboutcode.org/scancode/)** - Industry-leading code scanner

2. **Code Attribution Detection**:
   - **[Vendetect](https://github.com/trailofbits/vendetect)** - Detect copied/vendored code
   - **Custom GitHub search** for attribution mentions
   - **Google search alerts** for your SDK name

#### **📡 Built-in Telemetry (Privacy-Compliant)**

The SDK includes optional, privacy-first telemetry:

```typescript
import { reportUsage } from 'contextual-agent-sdk/utils/attribution';

// Optional usage reporting (production only, user-consented)
await reportUsage({
  projectName: 'my-chatbot',
  environment: 'production',
  features: ['voice-switching', 'context-management'],
  disableTelemetry: false // Set to true to disable
});
```

**Privacy Features**:
- ✅ **Opt-in only** - Disabled by default
- ✅ **Production only** - Never runs in development
- ✅ **Anonymous** - No personal data collected
- ✅ **Non-blocking** - Silently fails without affecting app
- ✅ **Transparent** - Full source code available

### **For SDK Users (Ensuring Compliance)**

#### **🏷️ Attribution Helpers**

Use built-in utilities to ensure proper attribution:

```typescript
import { 
  getAttribution, 
  getHTMLAttribution, 
  getMarkdownAttribution,
  getAttributionBadge,
  validateAttribution 
} from 'contextual-agent-sdk/utils/attribution';

// Get attribution info
const attribution = getAttribution();
console.log(attribution.author); // "simcoder technologies a subsidiary of SCS Group"

// Generate HTML for your app
const htmlCredit = getHTMLAttribution();
// Returns: "Powered by <a href="...">Contextual Agent SDK</a> by simcoder technologies"

// Add badge to README
const badge = getAttributionBadge('markdown');
// Returns: [![Powered by Contextual Agent SDK](https://img.shields.io/badge/...)](https://github.com/simcoder/contextual-agent-sdk)

// Validate your package.json includes proper attribution
const validation = validateAttribution(require('./package.json'));
if (!validation.isValid) {
  console.log('Attribution suggestions:', validation.suggestions);
}

// Log attribution during development
logAttribution();
```

#### **🎯 Easy Attribution Examples**

**React Component:**
```tsx
function AboutPage() {
  const attribution = getAttribution();
  return (
    <div>
      <p>This app uses {attribution.library} by simcoder technologies</p>
      <a href={attribution.url}>Learn more about the technology</a>
    </div>
  );
}
```

**Package.json Credits:**
```json
{
  "credits": {
    "contextual-agent-sdk": "simcoder technologies - https://github.com/simcoder/contextual-agent-sdk"
  }
}
```

## 🔐 **License Enforcement Strategy**

### **Legal Protection**
- ✅ **MIT License with Attribution Clause** - Legally enforceable
- ✅ **Clear attribution requirements** in LICENSE file
- ✅ **Multiple attribution options** (flexible compliance)

### **Technical Monitoring**
- ✅ **Automated scanning** with tools like SCANOSS and ScanCode
- ✅ **GitHub search alerts** for usage without attribution  
- ✅ **Download analytics** to track adoption
- ✅ **Code fingerprinting** to detect unauthorized copies

### **Community Enforcement**
- ✅ **Clear documentation** makes compliance easy
- ✅ **Helpful tools** reduce friction for proper attribution
- ✅ **Community reporting** via GitHub issues
- ✅ **Professional follow-up** for violations

## 🎯 **Recommended Monitoring Setup**

### **For Comprehensive Tracking**:

1. **Set up NPM download monitoring**:
   ```bash
   npm install -g npm-download-stats
   npm-download-stats contextual-agent-sdk
   ```

2. **Enable GitHub repository insights**:
   - Go to **Settings > Features > Insights**
   - Enable **Traffic** and **Community** analytics

3. **Use YHYPE for extended analytics**:
   - Sign up at [yhype.me](https://yhype.me)
   - Connect your GitHub account
   - Track repository metrics beyond 14 days

4. **Set up Google Alerts**:
   ```
   "contextual-agent-sdk" -site:github.com -site:npmjs.com
   "simcoder technologies" "AI agent"
   ```

5. **Deploy license scanning**:
   ```bash
   # Install SCANOSS
   pip install scanoss
   
   # Scan for your code usage
   scanoss scan /path/to/suspect/repository
   ```

## 🏷️ Attribution Requirements

If you use this SDK in your project, please provide attribution to **simcoder technologies a subsidiary of SCS Group** as the creator. You can do this in one of the following ways:

#### **In Your Application:**
```html
<!-- In your app footer or about section -->
Powered by <a href="https://github.com/simcoder/contextual-agent-sdk">Contextual Agent SDK</a> by simcoder technologies
```

#### **In Your README:**
```markdown
## Credits
- Uses [Contextual Agent SDK](https://github.com/simcoder/contextual-agent-sdk) by simcoder technologies for seamless voice-text AI interactions
```

#### **In Package.json:**
```json
{
  "credits": {
    "contextual-agent-sdk": "simcoder technologies - https://github.com/simcoder/contextual-agent-sdk"
  }
}
```

#### **Programmatic Attribution (Easy Way):**
```typescript
import { getAttribution, getHTMLAttribution, logAttribution } from 'contextual-agent-sdk';

// Get attribution info
const attribution = getAttribution();
console.log(attribution.author); // "simcoder technologies a subsidiary of SCS Group"

// Generate HTML for your app
const htmlCredit = getHTMLAttribution();
// Returns: "Powered by <a href="...">Contextual Agent SDK</a> by simcoder technologies"

// Log attribution during development
logAttribution(); // Shows attribution info in console

// For React/Vue components
function AboutPage() {
  const attribution = getAttribution();
  return (
    <div>
      <p>This app uses {attribution.library} by simcoder technologies</p>
      <a href={attribution.url}>Learn more about the technology</a>
    </div>
  );
}
```

### 🙏 Why Attribution Matters

This SDK represents significant innovation in AI agent technology. Attribution helps:
- ✅ Give credit where credit is due
- ✅ Help others discover this technology
- ✅ Support continued development and improvement
- ✅ Build a community around the innovation

**Thank you for using Contextual Agent SDK responsibly!**

---

## 🌟 Why Choose Contextual Agent SDK?

- ✅ **First SDK** to solve seamless voice-text context switching
- ✅ **Production Ready** with enterprise-grade features
- ✅ **Provider Agnostic** - use any LLM or speech service
- ✅ **TypeScript First** - full type safety and great DX
- ✅ **Modular Design** - use only what you need
- ✅ **Comprehensive Documentation** - examples and guides
- ✅ **Active Development** - regular updates and improvements

**Ready to build the future of conversational AI?** Get started with Contextual Agent SDK today! 

This comprehensive monitoring approach ensures you can track usage, enforce attribution, and protect your intellectual property while maintaining the open-source nature of your SDK! 🚀 