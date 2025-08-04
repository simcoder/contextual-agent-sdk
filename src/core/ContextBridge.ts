/**
 * ContextBridge - Core class for seamless modality switching
 * 
 * Handles the translation of context between different modalities (voice/text)
 * by adapting the format, style, and content to be appropriate for each mode
 * while preserving the semantic meaning and conversational state.
 */
export class ContextBridge {
  private cache: Map<string, any> = new Map();

  /**
   * Adapts conversation context for a target modality
   * 
   * @param context - Current conversation context
   * @param sourceModality - Current modality (voice/text)
   * @param targetModality - Desired modality (voice/text)
   * @returns Adapted context string
   */
  public bridgeContext(
    context: string,
    sourceModality: 'voice' | 'text',
    targetModality: 'voice' | 'text'
  ): string {
    // If same modality, no adaptation needed
    if (sourceModality === targetModality) {
      return context;
    }

    // Voice → Text: Structure and formalize
    if (sourceModality === 'voice' && targetModality === 'text') {
      return this.voiceToTextBridge(context);
    }

    // Text → Voice: Make conversational and natural
    if (sourceModality === 'text' && targetModality === 'voice') {
      return this.textToVoiceBridge(context);
    }

    return context;
  }

  /**
   * Adapts voice context for text modality
   * - Structures informal speech into clear sections
   * - Extracts and formats key information
   * - Preserves semantic meaning while improving readability
   */
  private voiceToTextBridge(context: string): string {
    // Remove speech artifacts
    let bridged = context
      .replace(/um|uh|like|you know/gi, '')
      .replace(/(\s)+/g, ' ')
      .trim();

    // Structure into sections if multiple topics detected
    const topics = this.detectTopics(bridged);
    if (topics.length > 1) {
      bridged = topics.map(topic => `${topic.heading}:\n${topic.content}`).join('\n\n');
    }

    // Format lists and key points
    bridged = this.formatLists(bridged);
    bridged = this.highlightKeyPoints(bridged);

    return bridged;
  }

  /**
   * Adapts text context for voice modality
   * - Makes formal text more conversational
   * - Simplifies complex structures
   * - Adds natural speech patterns
   */
  private textToVoiceBridge(context: string): string {
    // Simplify formal language
    let bridged = context
      .replace(/therefore|however|moreover/gi, 'so')
      .replace(/additionally/gi, 'also')
      .replace(/regarding/gi, 'about');

    // Break up long sentences
    bridged = this.splitLongSentences(bridged);

    // Add conversational markers
    bridged = this.addConversationalMarkers(bridged);

    return bridged;
  }

  private detectTopics(text: string): Array<{heading: string; content: string}> {
    // Simple topic detection based on sentence boundaries and keywords
    const topics: Array<{heading: string; content: string}> = [];
    const sentences = text.split(/[.!?]+/);
    let currentTopic = '';
    let currentContent: string[] = [];

    sentences.forEach(sentence => {
      const keywords = this.extractKeywords(sentence);
      if (this.isNewTopic(keywords, currentTopic)) {
        if (currentTopic) {
          topics.push({
            heading: currentTopic,
            content: currentContent.join('. ')
          });
        }
        currentTopic = this.generateTopicHeading(keywords);
        currentContent = [sentence];
      } else {
        currentContent.push(sentence);
      }
    });

    if (currentTopic) {
      topics.push({
        heading: currentTopic,
        content: currentContent.join('. ')
      });
    }

    return topics;
  }

  private formatLists(text: string): string {
    return text.replace(/([.!?]+)\s*(\d+\.|[-•])/g, '$1\n\n$2');
  }

  private highlightKeyPoints(text: string): string {
    const keywords = ['important', 'key', 'must', 'critical', 'essential'];
    let highlighted = text;
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    });
    return highlighted;
  }

  private splitLongSentences(text: string): string {
    return text.replace(/([^.!?]+[.!?]+)/g, (sentence) => {
      if (sentence.length > 100) {
        const parts = sentence.split(/,|;|\band\b|\bor\b/);
        return parts.join('.\n');
      }
      return sentence;
    });
  }

  private addConversationalMarkers(text: string): string {
    const markers = [
      'you see',
      'basically',
      'actually',
      'right',
      'well'
    ];
    
    return text.split('\n').map(line => {
      if (line.length > 50) {
        const marker = markers[Math.floor(Math.random() * markers.length)];
        return `${marker}, ${line.charAt(0).toLowerCase() + line.slice(1)}`;
      }
      return line;
    }).join('\n');
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (could be enhanced with NLP)
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
  }

  private isNewTopic(keywords: string[], currentTopic: string): boolean {
    if (!currentTopic) return true;
    const topicKeywords = this.extractKeywords(currentTopic);
    const overlap = keywords.filter(k => topicKeywords.includes(k));
    return overlap.length === 0;
  }

  private generateTopicHeading(keywords: string[]): string {
    return keywords
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'this', 'from', 'with', 'they', 'would', 'what', 'when',
      'there', 'about'
    ]);
    return stopWords.has(word);
  }

  public clearCache(): void {
    this.cache.clear();
  }
} 