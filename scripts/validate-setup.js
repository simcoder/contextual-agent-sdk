#!/usr/bin/env node

// Environment Setup Validation Script
// Run with: npm run validate-setup

const fs = require('fs');
const path = require('path');

console.log('🔍 CONTEXTUAL AGENT SDK - Environment Validation\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

console.log('📁 FILE CHECK:');
console.log('═══════════════════════════════════════════════════════════════════');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file found');
} else {
  console.log('❌ .env file not found');
  if (fs.existsSync(envExamplePath)) {
    console.log('💡 Run: npm run setup (to copy .env.example to .env)');
  }
  console.log('');
}

if (fs.existsSync(envExamplePath)) {
  console.log('✅ .env.example file found');
} else {
  console.log('❌ .env.example file missing');
}

console.log('');

// Load environment variables if .env exists
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Check environment variables
console.log('🔑 API KEY CHECK:');
console.log('═══════════════════════════════════════════════════════════════════');

const providers = [
  {
    name: 'OpenAI',
    env: 'OPENAI_API_KEY',
    pattern: /^sk-[a-zA-Z0-9]{48,}$/,
    docs: 'https://platform.openai.com/api-keys'
  },
  {
    name: 'Anthropic',
    env: 'ANTHROPIC_API_KEY', 
    pattern: /^sk-ant-[a-zA-Z0-9-]{95,}$/,
    docs: 'https://console.anthropic.com/'
  },
  {
    name: 'Ollama',
    env: 'OLLAMA_HOST',
    pattern: /^https?:\/\/.+$/,
    docs: 'https://ollama.ai/',
    default: 'http://localhost:11434'
  },
  {
    name: 'Custom API',
    env: 'CUSTOM_API_ENDPOINT',
    pattern: /^https?:\/\/.+$/,
    docs: 'Your custom LLM provider'
  }
];

let configuredProviders = 0;

providers.forEach(provider => {
  const value = process.env[provider.env];
  
  if (value) {
    if (provider.pattern && provider.pattern.test(value)) {
      console.log(`✅ ${provider.name}: Valid format`);
      configuredProviders++;
    } else {
      console.log(`⚠️  ${provider.name}: Invalid format`);
      console.log(`   Expected pattern: ${provider.pattern}`);
      console.log(`   Documentation: ${provider.docs}`);
    }
  } else {
    if (provider.default) {
      console.log(`ℹ️  ${provider.name}: Using default (${provider.default})`);
      configuredProviders++;
    } else {
      console.log(`❌ ${provider.name}: Not configured`);
      console.log(`   Get API key from: ${provider.docs}`);
    }
  }
});

console.log('');

// Check provider preferences
console.log('⚙️  PROVIDER PREFERENCES:');
console.log('═══════════════════════════════════════════════════════════════════');

const defaultProvider = process.env.DEFAULT_LLM_PROVIDER;
const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER;

if (defaultProvider) {
  console.log(`✅ Default provider: ${defaultProvider}`);
} else {
  console.log('ℹ️  Default provider: auto-detect');
}

if (fallbackProvider) {
  console.log(`✅ Fallback provider: ${fallbackProvider}`);
} else {
  console.log('ℹ️  Fallback provider: none');
}

console.log('');

// Summary and recommendations
console.log('📊 SUMMARY:');
console.log('═══════════════════════════════════════════════════════════════════');

if (configuredProviders === 0) {
  console.log('❌ No LLM providers configured');
  console.log('');
  console.log('🚀 QUICK START OPTIONS:');
  console.log('');
  console.log('Option 1 - Free Local Development:');
  console.log('   1. Install Ollama: https://ollama.ai/');
  console.log('   2. Run: ollama pull llama2');
  console.log('   3. Test: npm run demo:multi-llm');
  console.log('');
  console.log('Option 2 - Cloud API:');
  console.log('   1. Get API key from OpenAI or Anthropic');
  console.log('   2. Add to .env file');
  console.log('   3. Test: npm run demo:multi-llm');
} else if (configuredProviders === 1) {
  console.log(`✅ ${configuredProviders} provider configured`);
  console.log('💡 Consider adding a fallback provider for reliability');
} else {
  console.log(`✅ ${configuredProviders} providers configured - Excellent!`);
  console.log('🎉 Your multi-LLM setup is ready for production');
}

console.log('');

// Test recommendations
console.log('🧪 NEXT STEPS:');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('1. Test your setup: npm run demo:multi-llm');
console.log('2. Run unit tests: npm test');
console.log('3. Start HTTP demo: npm run demo');
console.log('4. See business demo: npm run demo:investor');

if (configuredProviders > 0) {
  console.log('');
  console.log('🌟 Ready to build amazing AI agents with context bridging!');
}

console.log(''); 