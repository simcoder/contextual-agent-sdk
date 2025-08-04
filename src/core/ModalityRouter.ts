import { Modality, Message, MessageRole, VoiceMetadata } from '../types';

export interface SpeechToTextProvider {
  transcribe(audioInput: any, options?: {
    language?: string;
    model?: string;
    temperature?: number;
    responseFormat?: 'json' | 'text' | 'verbose_json';
    prompt?: string; // For context/guidance
    [key: string]: any; // Allow provider-specific options
  }): Promise<{
    text: string;
    confidence?: number;
    language?: string;
    duration?: number;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
      confidence?: number;
    }>;
    [key: string]: any; // Allow provider-specific response data
  }>;
}

export interface TextToSpeechProvider {
  synthesize(text: string, options?: {
    voice?: string;
    language?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
    format?: 'mp3' | 'wav' | 'ogg' | 'flac';
    sampleRate?: number;
    [key: string]: any; // Allow provider-specific options
  }): Promise<{
    audioData: any;
    duration?: number;
    format?: string;
    sampleRate?: number;
    [key: string]: any; // Allow provider-specific response data
  }>;
}

export interface ModalityRouterConfig {
  speechToText?: SpeechToTextProvider;
  textToSpeech?: TextToSpeechProvider;
  useMockWhenUnavailable?: boolean; // Default: true for development
  // Default options that will be passed to providers
  defaultSTTOptions?: {
    language?: string;
    model?: string;
    temperature?: number;
    responseFormat?: 'json' | 'text' | 'verbose_json';
    prompt?: string;
    [key: string]: any;
  };
  defaultTTSOptions?: {
    voice?: string;
    language?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
    format?: 'mp3' | 'wav' | 'ogg' | 'flac';
    [key: string]: any;
  };
}

/**
 * ModalityRouter - Routes messages between voice and text processing
 * Handles voice-to-text and text-to-voice conversions with configurable providers
 */
export class ModalityRouter {
  private isProcessing: boolean = false;
  private config: ModalityRouterConfig;

  constructor(config: ModalityRouterConfig = {}) {
    this.config = {
      useMockWhenUnavailable: true,
      ...config
    };
  }

  /**
   * Determines the modality of incoming message
   */
  public detectModality(input: any): Modality {
    // Check if input contains audio data
    if (this.isAudioInput(input)) {
      return 'voice';
    }
    
    // Default to text
    return 'text';
  }

  /**
   * Processes incoming message based on modality
   */
  public async processMessage(
    input: any,
    modality: Modality,
    sessionId: string
  ): Promise<Message> {
    this.isProcessing = true;

    try {
      let message: Message;

      if (modality === 'voice') {
        message = await this.processVoiceMessage(input, sessionId);
      } else {
        message = await this.processTextMessage(input, sessionId);
      }

      return message;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes voice input and converts to text
   */
  private async processVoiceMessage(
    audioInput: any,
    sessionId: string
  ): Promise<Message> {
    const startTime = Date.now();

    try {
      let transcriptionResult;

      if (this.config.speechToText) {
        // Use provided speech-to-text provider with default options
        transcriptionResult = await this.config.speechToText.transcribe(
          audioInput, 
          this.config.defaultSTTOptions
        );
      } else if (this.config.useMockWhenUnavailable) {
        // Fall back to mock implementation
        console.warn('No speech-to-text provider configured. Using mock transcription.');
        transcriptionResult = await this.mockSpeechToText(audioInput);
      } else {
        throw new Error('No speech-to-text provider configured and mocks are disabled');
      }

      const voiceMetadata: VoiceMetadata = {
        duration: transcriptionResult.duration || this.getAudioDuration(audioInput),
        language: transcriptionResult.language || 'en-US',
        confidence: transcriptionResult.confidence || 0.95,
      };

      const message: Message = {
        id: this.generateMessageId(),
        role: 'user' as MessageRole,
        content: transcriptionResult.text,
        modality: 'voice',
        timestamp: new Date(),
        metadata: {
          voice: voiceMetadata,
          performance: {
            processingTime: Date.now() - startTime,
            apiCalls: [
              {
                service: 'speech-to-text',
                endpoint: this.config.speechToText ? 'custom-provider' : 'mock',
                duration: Date.now() - startTime,
                status: 200
              }
            ]
          }
        }
      };

      return message;
    } catch (error) {
      throw new Error(`Voice processing failed: ${error}`);
    }
  }

  /**
   * Processes text input
   */
  private async processTextMessage(
    textInput: string,
    sessionId: string
  ): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      role: 'user' as MessageRole,
      content: textInput.trim(),
      modality: 'text',
      timestamp: new Date(),
      metadata: {
        performance: {
          processingTime: 1, // Minimal for text
          apiCalls: []
        }
      }
    };

    return message;
  }

  /**
   * Prepares response for specific modality
   */
  public async prepareResponse(
    content: string,
    targetModality: Modality,
    sessionId: string
  ): Promise<Message> {
    const startTime = Date.now();
    const message: Message = {
      id: this.generateMessageId(),
      role: 'assistant' as MessageRole,
      content,
      modality: targetModality,
      timestamp: new Date()
    };

    if (targetModality === 'voice') {
      // Add voice-specific processing
      message.metadata = {
        voice: await this.prepareVoiceResponse(content),
        performance: {
          processingTime: Date.now() - startTime,
          apiCalls: []
        }
      };
    } else {
      // Text response metadata
      message.metadata = {
        performance: {
          processingTime: 1,
          apiCalls: []
        }
      };
    }

    return message;
  }

  /**
   * Prepares voice response metadata
   */
  private async prepareVoiceResponse(content: string): Promise<VoiceMetadata> {
          if (this.config.textToSpeech) {
        try {
          const audioResult = await this.config.textToSpeech.synthesize(
            content, 
            this.config.defaultTTSOptions
          );
        return {
          language: 'en-US', // Could be configurable
          confidence: 1.0,
          duration: audioResult.duration || this.estimateVoiceDuration(content)
        };
      } catch (error) {
        console.error('Text-to-speech failed:', error);
        if (!this.config.useMockWhenUnavailable) {
          throw error;
        }
        // Fall back to mock
      }
    }

    if (this.config.useMockWhenUnavailable) {
      console.warn('No text-to-speech provider configured. Using mock audio generation.');
      // Mock voice response
      return {
        language: 'en-US',
        confidence: 1.0,
        duration: this.estimateVoiceDuration(content)
      };
    }

    throw new Error('No text-to-speech provider configured and mocks are disabled');
  }

  /**
   * Set speech-to-text provider at runtime
   */
  public setSpeechToTextProvider(provider: SpeechToTextProvider): void {
    this.config.speechToText = provider;
  }

  /**
   * Set text-to-speech provider at runtime
   */
  public setTextToSpeechProvider(provider: TextToSpeechProvider): void {
    this.config.textToSpeech = provider;
  }

  /**
   * Update default STT options at runtime
   */
  public setDefaultSTTOptions(options: NonNullable<ModalityRouterConfig['defaultSTTOptions']>): void {
    this.config.defaultSTTOptions = { ...this.config.defaultSTTOptions, ...options };
  }

  /**
   * Update default TTS options at runtime
   */
  public setDefaultTTSOptions(options: NonNullable<ModalityRouterConfig['defaultTTSOptions']>): void {
    this.config.defaultTTSOptions = { ...this.config.defaultTTSOptions, ...options };
  }

  /**
   * Transcribe with custom options (overrides defaults)
   */
  public async transcribeWithOptions(
    audioInput: any,
    options?: Parameters<SpeechToTextProvider['transcribe']>[1]
  ): Promise<ReturnType<SpeechToTextProvider['transcribe']>> {
    if (!this.config.speechToText) {
      if (this.config.useMockWhenUnavailable) {
        return this.mockSpeechToText(audioInput);
      }
      throw new Error('No speech-to-text provider configured');
    }

    const mergedOptions = { ...this.config.defaultSTTOptions, ...options };
    return this.config.speechToText.transcribe(audioInput, mergedOptions);
  }

  /**
   * Synthesize with custom options (overrides defaults)
   */
  public async synthesizeWithOptions(
    text: string,
    options?: Parameters<TextToSpeechProvider['synthesize']>[1]
  ): Promise<ReturnType<TextToSpeechProvider['synthesize']>> {
    if (!this.config.textToSpeech) {
      throw new Error('No text-to-speech provider configured');
    }

    const mergedOptions = { ...this.config.defaultTTSOptions, ...options };
    return this.config.textToSpeech.synthesize(text, mergedOptions);
  }

  /**
   * Check if speech capabilities are available
   */
  public hasSpeechToText(): boolean {
    return !!this.config.speechToText;
  }

  public hasTextToSpeech(): boolean {
    return !!this.config.textToSpeech;
  }

  /**
   * Checks if input contains audio data
   */
  private isAudioInput(input: any): boolean {
    // Simple check - in production, this would be more sophisticated
    if (!input) return false;
    
    // Check for common audio properties
    return (
      input.type === 'audio' ||
      input.mimeType?.startsWith('audio/') ||
      input.audioData ||
      input.wav ||
      input.mp3 ||
      input.webm ||
      input.blob ||
      Buffer.isBuffer(input) ||
      input instanceof ArrayBuffer ||
      input instanceof Uint8Array
    );
  }

  /**
   * Mock speech-to-text conversion (fallback)
   */
  private async mockSpeechToText(audioInput: any): Promise<{
    text: string;
    confidence: number;
    language: string;
    duration?: number;
  }> {
    // Simulate API delay
    await this.delay(100);
    
    // Mock transcription based on input type
    if (typeof audioInput === 'string') {
      return {
        text: audioInput,
        confidence: 1.0,
        language: 'en-US'
      };
    }
    
    // Default mock transcription
    return {
      text: "I'd like to speak with customer service about my order.",
      confidence: 0.85,
      language: 'en-US',
      duration: this.getAudioDuration(audioInput)
    };
  }

  /**
   * Gets audio duration from input
   */
  private getAudioDuration(audioInput: any): number {
    // Try to get duration from input metadata
    if (audioInput?.duration) {
      return audioInput.duration;
    }
    
    if (audioInput?.metadata?.duration) {
      return audioInput.metadata.duration;
    }
    
    // Estimate based on data size (rough approximation)
    if (audioInput?.length || audioInput?.byteLength) {
      const bytes = audioInput.length || audioInput.byteLength;
      // Assume 16kHz, 16-bit mono audio = ~32KB per second
      return Math.max(0.5, bytes / 32000);
    }
    
    // Default estimate
    return 3.5; // seconds
  }

  /**
   * Estimates voice duration for text
   */
  private estimateVoiceDuration(text: string): number {
    // Rough estimate: 150 words per minute
    const wordCount = text.split(/\s+/).length;
    const wordsPerSecond = 150 / 60;
    return Math.max(1, wordCount / wordsPerSecond);
  }

  /**
   * Generates unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets processing status
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Validates modality support
   */
  public isModalitySupported(modality: Modality): boolean {
    if (modality === 'text') return true;
    if (modality === 'voice') {
      return this.hasSpeechToText() || (this.config.useMockWhenUnavailable ?? false);
    }
    return false;
  }

  /**
   * Gets modality capabilities
   */
  public getCapabilities(): { 
    voice: boolean; 
    text: boolean; 
    speechToText: boolean;
    textToSpeech: boolean;
    usingMocks: boolean;
  } {
    return {
      voice: this.isModalitySupported('voice'),
      text: true,
      speechToText: this.hasSpeechToText(),
      textToSpeech: this.hasTextToSpeech(),
      usingMocks: (this.config.useMockWhenUnavailable ?? false) && (!this.hasSpeechToText() || !this.hasTextToSpeech())
    };
  }
} 