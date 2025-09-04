// Embedding Service for RAG System
// Handles text-to-vector conversion using various providers

import {
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  RAGError,
  RAGErrorCode
} from './types';

/**
 * Abstract base class for embedding providers
 */
abstract class EmbeddingProvider {
  protected config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  abstract generateEmbeddings(texts: string[]): Promise<number[][]>;
  abstract getDimensions(): number;
}

/**
 * OpenAI Embedding Provider
 */
class OpenAIEmbeddingProvider extends EmbeddingProvider {
  private apiKey: string;

  constructor(config: EmbeddingConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new RAGError(
        'OpenAI API key is required for OpenAI embedding provider',
        RAGErrorCode.CONFIG_ERROR,
        { provider: 'openai' },
        false
      );
    }
    
    this.apiKey = config.apiKey;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batches = this.createBatches(texts, this.config.batchSize);
    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      const batchEmbeddings = await this.processBatch(batch);
      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  }

  private async processBatch(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🔄 Processing OpenAI embedding batch: ${texts.length} texts`);
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new RAGError(
          `OpenAI API error: ${response.status} ${response.statusText}`,
          RAGErrorCode.EMBEDDING_ERROR,
          { status: response.status, error: errorData },
          response.status === 429 || response.status >= 500
        );
      }

      const data = await response.json();
      
      console.log(`✅ OpenAI embeddings generated:`, {
        count: data.data.length,
        model: data.model,
        usage: data.usage
      });

      return data.data.map((item: any) => item.embedding);

    } catch (error) {
      console.error('❌ OpenAI embedding error:', error);
      
      if (error instanceof RAGError) {
        throw error;
      }
      
      throw new RAGError(
        `Failed to generate OpenAI embeddings: ${error.message}`,
        RAGErrorCode.EMBEDDING_ERROR,
        { originalError: error.message },
        true
      );
    }
  }

  getDimensions(): number {
    const dimensionMap: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536
    };

    return dimensionMap[this.config.model] || this.config.dimensions;
  }

  private createBatches(texts: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Local/Mock Embedding Provider for development
 */
class LocalEmbeddingProvider extends EmbeddingProvider {
  private cache: Map<string, number[]> = new Map();

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`🔄 Generating local embeddings for ${texts.length} texts`);
    
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      // Check cache first
      if (this.cache.has(text)) {
        embeddings.push(this.cache.get(text)!);
        continue;
      }

      // Generate deterministic embedding based on text content
      const embedding = this.generateDeterministicEmbedding(text);
      this.cache.set(text, embedding);
      embeddings.push(embedding);
    }

    console.log(`✅ Generated ${embeddings.length} local embeddings`);
    return embeddings;
  }

  private generateDeterministicEmbedding(text: string): number[] {
    const dimensions = this.config.dimensions;
    const embedding = new Array(dimensions).fill(0);
    
    // Create a deterministic but meaningful embedding
    // This is a simplified approach for development/testing
    
    const words = text.toLowerCase().split(/\s+/);
    const chars = text.toLowerCase();
    
    // Use character frequencies and word patterns
    for (let i = 0; i < dimensions; i++) {
      let value = 0;
      
      // Character-based features
      const charIndex = i % chars.length;
      if (charIndex < chars.length) {
        value += chars.charCodeAt(charIndex) / 255.0;
      }
      
      // Word-based features
      const wordIndex = i % words.length;
      if (wordIndex < words.length) {
        const word = words[wordIndex];
        value += (word.length / 20.0); // Normalize word length
        
        // Add some randomness based on word hash
        let hash = 0;
        for (let j = 0; j < word.length; j++) {
          hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
        }
        value += (Math.abs(hash) % 1000) / 1000.0;
      }
      
      // Text length feature
      value += Math.min(text.length / 1000.0, 1.0);
      
      // Position-based variation
      value += Math.sin(i * 0.1) * 0.1;
      
      // Normalize to reasonable range
      embedding[i] = (value % 2.0) - 1.0; // Range: -1 to 1
    }
    
    // Normalize the vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  getDimensions(): number {
    return this.config.dimensions;
  }
}

/**
 * Main Embedding Service
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.provider = this.createProvider(config);
    
    console.log(`🚀 Initialized EmbeddingService:`, {
      provider: config.provider,
      model: config.model,
      dimensions: this.provider.getDimensions(),
      batchSize: config.batchSize
    });
  }

  /**
   * Generate embeddings for a list of texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const startTime = Date.now();
    
    // Clean and validate texts
    const cleanTexts = texts.map(text => this.cleanText(text));
    const validTexts = cleanTexts.filter(text => text.length > 0);

    if (validTexts.length === 0) {
      throw new RAGError(
        'No valid texts provided for embedding generation',
        RAGErrorCode.EMBEDDING_ERROR,
        { originalCount: texts.length },
        false
      );
    }

    try {
      const embeddings = await this.provider.generateEmbeddings(validTexts);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Generated embeddings:`, {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        duration: `${duration}ms`,
        avgPerText: `${(duration / embeddings.length).toFixed(2)}ms`
      });

      return embeddings;

    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      
      if (error instanceof RAGError) {
        throw error;
      }
      
      throw new RAGError(
        `Embedding generation failed: ${error.message}`,
        RAGErrorCode.EMBEDDING_ERROR,
        { textsCount: validTexts.length, provider: this.config.provider },
        true
      );
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Get the dimensionality of embeddings
   */
  getDimensions(): number {
    return this.provider.getDimensions();
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embeddingA: number[], embeddingB: number[]): number {
    if (embeddingA.length !== embeddingB.length) {
      throw new RAGError(
        'Embedding dimensions must match for similarity calculation',
        RAGErrorCode.EMBEDDING_ERROR,
        { dimA: embeddingA.length, dimB: embeddingB.length },
        false
      );
    }

    return this.cosineSimilarity(embeddingA, embeddingB);
  }

  /**
   * Batch similarity calculation
   */
  calculateSimilarities(queryEmbedding: number[], candidateEmbeddings: number[][]): number[] {
    return candidateEmbeddings.map(embedding => 
      this.calculateSimilarity(queryEmbedding, embedding)
    );
  }

  // Private methods

  private createProvider(config: EmbeddingConfig): EmbeddingProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIEmbeddingProvider(config);
      
      case 'local':
        return new LocalEmbeddingProvider(config);
      
      case 'anthropic':
        // TODO: Implement Anthropic embedding provider when available
        throw new RAGError(
          'Anthropic embedding provider not yet implemented',
          RAGErrorCode.CONFIG_ERROR,
          { provider: config.provider },
          false
        );
      
      default:
        throw new RAGError(
          `Unknown embedding provider: ${config.provider}`,
          RAGErrorCode.CONFIG_ERROR,
          { provider: config.provider },
          false
        );
    }
  }

  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:()\-]/g, '') // Remove special characters
      .substring(0, 8000); // Limit length to prevent API issues
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

/**
 * Factory function to create embedding service
 */
export function createEmbeddingService(config: EmbeddingConfig): EmbeddingService {
  return new EmbeddingService(config);
}

/**
 * Utility functions for embedding operations
 */
export class EmbeddingUtils {
  /**
   * Normalize a vector to unit length
   */
  static normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  /**
   * Calculate the centroid of multiple embeddings
   */
  static calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }
    
    return centroid;
  }

  /**
   * Find the most representative embedding from a set
   */
  static findMostRepresentative(embeddings: number[][]): { index: number; embedding: number[] } {
    if (embeddings.length === 0) throw new Error('No embeddings provided');
    if (embeddings.length === 1) return { index: 0, embedding: embeddings[0] };

    const centroid = this.calculateCentroid(embeddings);
    let bestIndex = 0;
    let bestSimilarity = -1;

    for (let i = 0; i < embeddings.length; i++) {
      const similarity = this.cosineSimilarity(embeddings[i], centroid);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    return { index: bestIndex, embedding: embeddings[bestIndex] };
  }

  private static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }
}
