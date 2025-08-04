import { ContextProvider, ContextResult, BaseConfig } from '../types/context';
import * as fs from 'fs';
import * as path from 'path';

interface DocumentSource {
  type: 'file' | 'directory' | 'url' | 'custom';
  path: string;
  format?: 'markdown' | 'text' | 'json' | 'auto';
  encoding?: string;
  weight?: number; // Priority weight for this source
  tags?: string[];
}

interface KnowledgeBaseConfig extends BaseConfig {
  options?: {
    sources?: DocumentSource[];
    searchType?: 'exact' | 'fuzzy' | 'semantic';
    maxResults?: number;
    chunkSize?: number; // For large documents
    customSearch?: (query: string) => Promise<any[]>;
    // Auto-discover common documentation files
    autoDiscoverDocs?: {
      enabled?: boolean;
      rootPath?: string;
      patterns?: string[]; // File patterns to look for
      recursive?: boolean;
    };
  };
}

export class KnowledgeBaseProvider implements ContextProvider {
  public id: string;
  public name: string;
  public source: 'knowledge_base' = 'knowledge_base';
  public priority: number;
  public enabled: boolean;

  private config: KnowledgeBaseConfig;
  private documentCache: Map<string, { content: string; lastModified: number }> = new Map();

  constructor(config: KnowledgeBaseConfig) {
    this.config = config;
    this.id = config.id || 'knowledge_base';
    this.name = config.name || 'Knowledge Base Provider';
    this.priority = config.priority || 80;
    this.enabled = config.enabled ?? true;

    // Auto-discover documentation if enabled
    if (this.config.options?.autoDiscoverDocs?.enabled) {
      this.autoDiscoverDocuments();
    }
  }

  async getContext(params: { query?: string }): Promise<ContextResult | null> {
    try {
      const results: any[] = [];

      // Use custom search if provided
      if (this.config.options?.customSearch && params.query) {
        const customResults = await this.config.options.customSearch(params.query);
        results.push(...customResults);
      }

      // Search through configured sources
      if (this.config.options?.sources) {
        for (const source of this.config.options.sources) {
          const sourceResults = await this.searchDocumentSource(source, params.query);
          results.push(...sourceResults);
        }
      }

      if (results.length === 0) {
        return null;
      }

      return this.formatResults(results);
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return null;
    }
  }

  // Optional custom formatter
  formatContext(context: ContextResult): string {
    if (typeof context.content === 'string') {
      return `Documentation:\n${context.content}`;
    }
    
    if (Array.isArray(context.content)) {
      return `Documentation:\n${context.content.map((item: any, i: number) => {
        const title = item.title || item.filename || `Document ${i + 1}`;
        const content = item.content || item.text || JSON.stringify(item);
        const source = item.source ? ` (${item.source})` : '';
        return `\n## ${title}${source}\n${content}`;
      }).join('\n')}`;
    }

    return JSON.stringify(context.content, null, 2);
  }

  private async searchDocumentSource(source: DocumentSource, query?: string): Promise<any[]> {
    const results: any[] = [];

    try {
      switch (source.type) {
        case 'file':
          const fileResult = await this.loadFile(source.path, source);
          if (fileResult && this.matchesQuery(fileResult.content, query)) {
            results.push(fileResult);
          }
          break;

        case 'directory':
          const dirResults = await this.loadDirectory(source.path, source);
          results.push(...dirResults.filter(result => this.matchesQuery(result.content, query)));
          break;

        case 'url':
          const urlResult = await this.loadUrl(source.path, source);
          if (urlResult && this.matchesQuery(urlResult.content, query)) {
            results.push(urlResult);
          }
          break;

        case 'custom':
          // For custom sources, assume they're handled by customSearch
          break;
      }
    } catch (error) {
      console.error(`Error loading source ${source.path}:`, error);
    }

    return results;
  }

  private async loadFile(filePath: string, source: DocumentSource): Promise<any | null> {
    try {
      // Check cache first
      const cached = this.getCachedDocument(filePath);
      if (cached) {
        return {
          ...cached,
          source: filePath,
          type: 'file',
          tags: source.tags || [],
          weight: source.weight || 1
        };
      }

      // Read file
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, { encoding: (source.encoding as BufferEncoding) || 'utf8' });
      const parsed = this.parseDocument(content, source.format || this.detectFormat(filePath));

      // Cache the result
      this.cacheDocument(filePath, parsed.content, stats.mtimeMs);

      return {
        title: parsed.title || path.basename(filePath),
        content: parsed.content,
        filename: path.basename(filePath),
        source: filePath,
        type: 'file',
        tags: source.tags || [],
        weight: source.weight || 1,
        lastModified: stats.mtimeMs
      };
    } catch (error) {
      console.error(`Error loading file ${filePath}:`, error);
      return null;
    }
  }

  private async loadDirectory(dirPath: string, source: DocumentSource): Promise<any[]> {
    const results: any[] = [];

    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);

        if (stats.isFile() && this.isDocumentFile(file)) {
          const fileResult = await this.loadFile(fullPath, source);
          if (fileResult) {
            results.push(fileResult);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading directory ${dirPath}:`, error);
    }

    return results;
  }

  private async loadUrl(url: string, source: DocumentSource): Promise<any | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const parsed = this.parseDocument(content, source.format || this.detectFormat(url));

      return {
        title: parsed.title || url,
        content: parsed.content,
        source: url,
        type: 'url',
        tags: source.tags || [],
        weight: source.weight || 1
      };
    } catch (error) {
      console.error(`Error loading URL ${url}:`, error);
      return null;
    }
  }

  private parseDocument(content: string, format: string): { title?: string; content: string } {
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        return this.parseMarkdown(content);
      case 'json':
        return this.parseJson(content);
      case 'text':
      case 'txt':
      default:
        return { content };
    }
  }

  private parseMarkdown(content: string): { title?: string; content: string } {
    // Extract title from first H1 heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Clean up markdown for better context
    const cleanContent = content
      .replace(/^#{1,6}\s+/gm, '') // Remove heading markers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '[CODE BLOCK]') // Replace code blocks
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Replace links with text
      .trim();

    return { title, content: cleanContent };
  }

  private parseJson(content: string): { title?: string; content: string } {
    try {
      const data = JSON.parse(content);
      
      // If it's a structured document with title and content
      if (data.title && data.content) {
        return { title: data.title, content: data.content };
      }
      
      // If it's documentation with sections
      if (data.sections) {
        const title = data.title || data.name;
        const content = data.sections.map((section: any) => 
          `${section.title || section.name}: ${section.content || section.description}`
        ).join('\n\n');
        return { title, content };
      }

      // Default: stringify the whole object
      return { content: JSON.stringify(data, null, 2) };
    } catch (error) {
      return { content };
    }
  }

  private detectFormat(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap: Record<string, string> = {
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.txt': 'text',
      '.json': 'json',
      '.readme': 'markdown'
    };
    
    return formatMap[ext] || 'auto';
  }

  private isDocumentFile(filename: string): boolean {
    const docExtensions = ['.md', '.txt', '.json', '.markdown'];
    const docNames = ['readme', 'changelog', 'license', 'contributing', 'docs', 'documentation'];
    
    const ext = path.extname(filename).toLowerCase();
    const name = path.basename(filename, ext).toLowerCase();
    
    return docExtensions.includes(ext) || docNames.includes(name);
  }

  private autoDiscoverDocuments(): void {
    const autoConfig = this.config.options?.autoDiscoverDocs;
    if (!autoConfig?.enabled) return;

    const rootPath = autoConfig.rootPath || process.cwd();
    const patterns = autoConfig.patterns || [
      'README.md', 'README.txt', 'README',
      'CHANGELOG.md', 'CHANGELOG.txt',
      'LICENSE', 'LICENSE.md', 'LICENSE.txt',
      'CONTRIBUTING.md', 'CONTRIBUTING.txt',
      'docs/**/*.md', 'documentation/**/*.md',
      '*.md' // Any markdown file in root
    ];

    const discoveredSources: DocumentSource[] = [];

    patterns.forEach(pattern => {
      try {
        // Simple pattern matching for common files
        if (!pattern.includes('*')) {
          const filePath = path.join(rootPath, pattern);
          if (fs.existsSync(filePath)) {
            discoveredSources.push({
              type: 'file',
              path: filePath,
              format: 'auto',
              weight: this.getDocumentWeight(pattern),
              tags: ['auto-discovered', this.getDocumentType(pattern)]
            });
          }
        } else {
          // For patterns with wildcards, scan directories
          const dirPath = pattern.includes('/') ? path.dirname(pattern) : rootPath;
          if (fs.existsSync(path.join(rootPath, dirPath))) {
            discoveredSources.push({
              type: 'directory',
              path: path.join(rootPath, dirPath),
              format: 'auto',
              weight: 0.7,
              tags: ['auto-discovered', 'directory']
            });
          }
        }
      } catch (error) {
        console.warn(`Could not auto-discover pattern ${pattern}:`, error);
      }
    });

    // Add discovered sources to config
    if (!this.config.options) {
      this.config.options = {};
    }
    if (!this.config.options.sources) {
      this.config.options.sources = [];
    }
    this.config.options.sources.push(...discoveredSources);

    console.log(`Auto-discovered ${discoveredSources.length} documentation sources`);
  }

  private getDocumentWeight(filename: string): number {
    const name = filename.toLowerCase();
    if (name.includes('readme')) return 1.0;
    if (name.includes('docs') || name.includes('documentation')) return 0.9;
    if (name.includes('changelog')) return 0.7;
    if (name.includes('contributing')) return 0.6;
    if (name.includes('license')) return 0.5;
    return 0.8;
  }

  private getDocumentType(filename: string): string {
    const name = filename.toLowerCase();
    if (name.includes('readme')) return 'readme';
    if (name.includes('changelog')) return 'changelog';
    if (name.includes('license')) return 'license';
    if (name.includes('contributing')) return 'contributing';
    if (name.includes('docs')) return 'documentation';
    return 'document';
  }

  private matchesQuery(content: string, query?: string): boolean {
    if (!query) return true;
    
    const searchType = this.config.options?.searchType || 'fuzzy';
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    switch (searchType) {
      case 'exact':
        return lowerContent.includes(lowerQuery);
      case 'fuzzy':
        // Simple fuzzy matching - check if most words are present
        const queryWords = lowerQuery.split(' ').filter(w => w.length > 2);
        const matchCount = queryWords.filter(word => lowerContent.includes(word)).length;
        return matchCount >= Math.ceil(queryWords.length * 0.6);
      case 'semantic':
        // For semantic search, you would integrate with a vector database
        // For now, fall back to fuzzy
        return this.matchesQuery(content, query);
      default:
        return true;
    }
  }

  private getCachedDocument(filePath: string): any | null {
    const cached = this.documentCache.get(filePath);
    if (!cached) return null;

    try {
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs > cached.lastModified) {
        this.documentCache.delete(filePath);
        return null;
      }
      return { content: cached.content };
    } catch (error) {
      this.documentCache.delete(filePath);
      return null;
    }
  }

  private cacheDocument(filePath: string, content: string, lastModified: number): void {
    this.documentCache.set(filePath, { content, lastModified });
  }

  private formatResults(results: any[]): ContextResult {
    // Sort by weight and limit results
    const maxResults = this.config.options?.maxResults || 5;
    const sortedResults = results
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, maxResults);

    return {
      content: sortedResults,
      metadata: {
        source: this.source,
        timestamp: new Date(),
        tags: ['knowledge_base', 'documentation'],
        resultCount: sortedResults.length,
        sources: sortedResults.map(r => r.source)
      }
    };
  }
} 