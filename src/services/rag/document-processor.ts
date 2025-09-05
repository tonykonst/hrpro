// Document Processor for RAG System
// Handles parsing, chunking, and preprocessing of documents

import {
  Document,
  DocumentChunk,
  DocumentType,
  DocumentMetadata,
  ChunkingConfig,
  ChunkMetadata,
  RAGError,
  RAGErrorCode
} from './types';

export class DocumentProcessor {
  private config: ChunkingConfig;

  constructor(config: ChunkingConfig) {
    this.config = config;
  }

  /**
   * Process a document: parse, clean, and chunk
   */
  async processDocument(
    content: string,
    type: DocumentType,
    metadata: DocumentMetadata = {}
  ): Promise<Document> {
    try {
      console.log(`📄 Processing ${type} document:`, {
        contentLength: content.length,
        title: metadata.title || 'Untitled'
      });

      // Clean and normalize content
      const cleanedContent = this.cleanContent(content);
      
      // Extract enhanced metadata
      const enhancedMetadata = await this.extractMetadata(
        cleanedContent,
        type,
        metadata
      );

      // Generate document ID
      const documentId = this.generateDocumentId(cleanedContent, type);

      // Create document
      const document: Document = {
        id: documentId,
        content: cleanedContent,
        type,
        metadata: enhancedMetadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Generate chunks
      document.chunks = await this.chunkDocument(document);

      console.log(`✅ Document processed:`, {
        id: documentId,
        chunks: document.chunks.length,
        totalTokens: document.chunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0)
      });

      return document;

    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw new RAGError(
        `Failed to process document: ${error instanceof Error ? error.message : String(error)}`,
        RAGErrorCode.DOCUMENT_PARSE_ERROR,
        { type, metadata },
        true
      );
    }
  }

  /**
   * Chunk a document into smaller, semantically coherent pieces
   */
  private async chunkDocument(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;

    switch (this.config.chunkingMethod) {
      case 'semantic':
        return this.semanticChunking(document);
      
      case 'sentence':
        return this.sentenceChunking(document);
      
      case 'paragraph':
        return this.paragraphChunking(document);
      
      case 'fixed':
      default:
        return this.fixedSizeChunking(document);
    }
  }

  /**
   * Semantic chunking - groups related content together
   */
  private async semanticChunking(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;

    // Split by paragraphs first
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    let currentChunk = '';
    let currentTokenCount = 0;
    let chunkIndex = 0;
    let startIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokenCount(paragraph);
      
      // If adding this paragraph would exceed limit, finalize current chunk
      if (currentTokenCount + paragraphTokens > this.config.maxChunkSize && currentChunk) {
        const chunk = await this.createChunk(
          document,
          currentChunk.trim(),
          chunkIndex,
          startIndex,
          startIndex + currentChunk.length
        );
        chunks.push(chunk);
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, this.config.overlapSize);
        currentChunk = overlapText + paragraph;
        currentTokenCount = this.estimateTokenCount(currentChunk);
        chunkIndex++;
        startIndex = startIndex + currentChunk.length - overlapText.length;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokenCount += paragraphTokens;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      const chunk = await this.createChunk(
        document,
        currentChunk.trim(),
        chunkIndex,
        startIndex,
        startIndex + currentChunk.length
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Sentence-based chunking
   */
  private async sentenceChunking(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(document.content);
    
    let currentChunk = '';
    let currentTokenCount = 0;
    let chunkIndex = 0;
    let startIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      if (currentTokenCount + sentenceTokens > this.config.maxChunkSize && currentChunk) {
        const chunk = await this.createChunk(
          document,
          currentChunk.trim(),
          chunkIndex,
          startIndex,
          startIndex + currentChunk.length
        );
        chunks.push(chunk);
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, this.config.overlapSize);
        currentChunk = overlapText + sentence;
        currentTokenCount = this.estimateTokenCount(currentChunk);
        chunkIndex++;
        startIndex = startIndex + currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokenCount += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      const chunk = await this.createChunk(
        document,
        currentChunk.trim(),
        chunkIndex,
        startIndex,
        startIndex + currentChunk.length
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  private async paragraphChunking(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const paragraphs = document.content.split(/\n\s*\n/).filter(p => p.trim());
    
    let chunkIndex = 0;
    let startIndex = 0;

    for (const paragraph of paragraphs) {
      const tokenCount = this.estimateTokenCount(paragraph);
      
      if (tokenCount <= this.config.maxChunkSize) {
        // Single paragraph chunk
        const chunk = await this.createChunk(
          document,
          paragraph.trim(),
          chunkIndex,
          startIndex,
          startIndex + paragraph.length
        );
        chunks.push(chunk);
      } else {
        // Split large paragraph using sentence chunking
        const subDocument = { ...document, content: paragraph };
        const subChunks = await this.sentenceChunking(subDocument);
        chunks.push(...subChunks);
      }
      
      chunkIndex++;
      startIndex += paragraph.length + 2; // +2 for \n\n
    }

    return chunks;
  }

  /**
   * Fixed-size chunking with overlap
   */
  private async fixedSizeChunking(document: Document): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    const words = content.split(/\s+/);
    
    let chunkIndex = 0;
    let wordIndex = 0;

    while (wordIndex < words.length) {
      const chunkWords: string[] = [];
      let tokenCount = 0;
      let startWordIndex = wordIndex;

      // Build chunk up to token limit
      while (wordIndex < words.length && tokenCount < this.config.maxChunkSize) {
        const word = words[wordIndex];
        const wordTokens = this.estimateTokenCount(word);
        
        if (tokenCount + wordTokens > this.config.maxChunkSize && chunkWords.length > 0) {
          break;
        }
        
        chunkWords.push(word);
        tokenCount += wordTokens;
        wordIndex++;
      }

      if (chunkWords.length > 0) {
        const chunkContent = chunkWords.join(' ');
        const startIndex = content.indexOf(chunkWords[0], 
          startWordIndex > 0 ? content.indexOf(words[startWordIndex - 1]) : 0
        );
        const endIndex = startIndex + chunkContent.length;

        const chunk = await this.createChunk(
          document,
          chunkContent,
          chunkIndex,
          startIndex,
          endIndex
        );
        chunks.push(chunk);
        chunkIndex++;

        // Apply overlap for next chunk
        if (wordIndex < words.length) {
          const overlapWords = Math.floor(this.config.overlapSize / 4); // Rough estimate
          wordIndex = Math.max(startWordIndex + chunkWords.length - overlapWords, startWordIndex + 1);
        }
      }
    }

    return chunks;
  }

  /**
   * Create a document chunk with metadata
   */
  private async createChunk(
    document: Document,
    content: string,
    chunkIndex: number,
    startIndex: number,
    endIndex: number
  ): Promise<DocumentChunk> {
    const tokenCount = this.estimateTokenCount(content);
    const keywords = this.extractKeywords(content);
    const topic = this.extractTopic(content, document.type);
    const importance = this.calculateImportance(content, document.type);
    const section = this.identifySection(content, document.type);

    const chunkMetadata: ChunkMetadata = {
      chunkIndex,
      tokenCount,
      topic,
      importance,
      keywords,
      section
    };

    return {
      id: `${document.id}_chunk_${chunkIndex}`,
      documentId: document.id,
      content,
      startIndex,
      endIndex,
      metadata: chunkMetadata
    };
  }

  /**
   * Clean and normalize document content
   */
  private cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/[ ]{2,}/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Extract and enhance document metadata
   */
  private async extractMetadata(
    content: string,
    type: DocumentType,
    existingMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    const metadata = { ...existingMetadata };

    // Extract title if not provided
    if (!metadata.title) {
      metadata.title = this.extractTitle(content, type);
    }

    // Extract type-specific metadata
    switch (type) {
      case 'job_description':
        const jobMetadata = this.extractJobMetadata(content);
        Object.assign(metadata, jobMetadata);
        break;
        
      case 'resume':
        const resumeMetadata = this.extractResumeMetadata(content);
        Object.assign(metadata, resumeMetadata);
        break;
    }

    // Extract general metadata
    metadata.tags = metadata.tags || this.extractTags(content);
    metadata.language = metadata.language || this.detectLanguage(content);

    return metadata;
  }

  /**
   * Extract job-specific metadata
   */
  private extractJobMetadata(content: string): Partial<DocumentMetadata> {
    const metadata: Partial<DocumentMetadata> = {};

    // Extract position title
    const positionMatch = content.match(/(?:position|role|title):\s*([^\n]+)/i);
    if (positionMatch) {
      metadata.position = positionMatch[1].trim();
    }

    // Extract company name
    const companyMatch = content.match(/(?:company|organization):\s*([^\n]+)/i);
    if (companyMatch) {
      metadata.company = companyMatch[1].trim();
    }

    // Extract requirements
    const requirementsSection = content.match(/(?:requirements|qualifications)[:\s]*([^]*?)(?:\n\n|\n[A-Z]|$)/i);
    if (requirementsSection) {
      metadata.requirements = this.extractListItems(requirementsSection[1]);
    }

    // Extract skills
    const skillsSection = content.match(/(?:skills|technologies)[:\s]*([^]*?)(?:\n\n|\n[A-Z]|$)/i);
    if (skillsSection) {
      metadata.skills = this.extractListItems(skillsSection[1]);
    }

    // Extract experience level
    const experienceMatch = content.match(/(\d+)\+?\s*years?\s*(?:of\s*)?experience/i);
    if (experienceMatch) {
      metadata.experience_level = `${experienceMatch[1]}+ years`;
    }

    return metadata;
  }

  /**
   * Extract resume-specific metadata
   */
  private extractResumeMetadata(content: string): Partial<DocumentMetadata> {
    const metadata: Partial<DocumentMetadata> = {};

    // Extract candidate name
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();
    if (firstLine && firstLine.length < 50 && /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(firstLine)) {
      metadata.candidate_name = firstLine;
    }

    // Extract email
    const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      metadata.candidate_email = emailMatch[1];
    }

    // Extract years of experience
    const expMatch = content.match(/(\d+)\+?\s*years?\s*(?:of\s*)?experience/i);
    if (expMatch) {
      metadata.years_experience = parseInt(expMatch[1]);
    }

    // Extract education
    const educationSection = content.match(/(?:education|degree)[:\s]*([^]*?)(?:\n\n|\n[A-Z]|$)/i);
    if (educationSection) {
      metadata.education = this.extractListItems(educationSection[1]);
    }

    return metadata;
  }

  /**
   * Utility methods
   */
  private generateDocumentId(content: string, type: DocumentType): string {
    const hash = this.simpleHash(content);
    const timestamp = Date.now();
    return `${type}_${hash}_${timestamp}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+\s+/)
      .filter(sentence => sentence.trim().length > 0)
      .map(sentence => sentence.trim());
  }

  private getOverlapText(text: string, overlapSize: number): string {
    const words = text.split(/\s+/);
    const overlapWords = Math.min(Math.floor(overlapSize / 4), words.length);
    return words.slice(-overlapWords).join(' ') + ' ';
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractTopic(content: string, type: DocumentType): string | undefined {
    const firstSentence = content.split(/[.!?]/)[0]?.trim();
    if (!firstSentence) return undefined;

    // Simple topic extraction based on content
    const topicKeywords = {
      job_description: ['developer', 'engineer', 'manager', 'analyst', 'designer'],
      resume: ['experience', 'skills', 'education', 'projects', 'achievements']
    };

    const keywords = (topicKeywords as Record<DocumentType, string[]>)[type] || [];
    for (const keyword of keywords) {
      if (firstSentence.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }

    return 'general';
  }

  private calculateImportance(content: string, type: DocumentType): number {
    // Simple importance scoring
    let score = 0.5; // Base score

    // Length factor
    if (content.length > 500) score += 0.2;
    if (content.length > 1000) score += 0.2;

    // Keyword density
    const importantWords = ['required', 'must', 'essential', 'experience', 'skills'];
    const wordCount = content.toLowerCase().split(/\s+/).length;
    const importantWordCount = importantWords.reduce((count, word) => {
      return count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);

    score += (importantWordCount / wordCount) * 0.3;

    return Math.min(score, 1.0);
  }

  private identifySection(content: string, type: DocumentType): string | undefined {
    const sectionPatterns = {
      job_description: {
        'requirements': /(?:requirements|qualifications)/i,
        'responsibilities': /(?:responsibilities|duties)/i,
        'skills': /(?:skills|technologies)/i,
        'benefits': /(?:benefits|perks)/i
      },
      resume: {
        'experience': /(?:experience|work|employment)/i,
        'education': /(?:education|degree|university)/i,
        'skills': /(?:skills|technologies|technical)/i,
        'projects': /(?:projects|portfolio)/i
      }
    };

    const patterns = (sectionPatterns as any)[type];
    if (!patterns) return undefined;

    for (const [section, pattern] of Object.entries(patterns)) {
      if ((pattern as RegExp).test(content)) {
        return section;
      }
    }

    return undefined;
  }

  private extractTitle(content: string, type: DocumentType): string {
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine;
    }

    // Fallback titles
    const fallbacks = {
      job_description: 'Job Description',
      resume: 'Resume',
      knowledge_base: 'Knowledge Base',
      interview_guide: 'Interview Guide',
      company_info: 'Company Information'
    };

    return fallbacks[type] || 'Document';
  }

  private extractTags(content: string): string[] {
    // Simple tag extraction based on common patterns
    const tags: string[] = [];
    
    // Technology tags
    const techPattern = /\b(React|Vue|Angular|Node\.js|Python|Java|JavaScript|TypeScript|Docker|Kubernetes|AWS|Azure|GCP)\b/gi;
    const techMatches = content.match(techPattern);
    if (techMatches) {
      tags.push(...techMatches.map(t => t.toLowerCase()));
    }

    return [...new Set(tags)];
  }

  private detectLanguage(content: string): string {
    // Simple language detection
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = content.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    const englishRatio = englishWordCount / words.length;

    return englishRatio > 0.1 ? 'en' : 'unknown';
  }

  private extractListItems(text: string): string[] {
    return text
      .split(/\n|•|\-/)
      .map(item => item.trim())
      .filter(item => item.length > 0 && item.length < 200)
      .slice(0, 20); // Limit to 20 items
  }
}
