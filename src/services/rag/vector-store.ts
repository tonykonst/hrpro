// Vector Store for RAG System
// Handles embedding storage, similarity search, and vector operations

import {
  DocumentChunk,
  VectorStoreConfig,
  VectorSearchResult,
  VectorQuery,
  RAGError,
  RAGErrorCode
} from './types';

// Simple in-memory vector store for local development
// In production, this could be replaced with Pinecone, Weaviate, or Chroma

interface StoredVector {
  id: string;
  embedding: number[];
  chunk: DocumentChunk;
  metadata: Record<string, any>;
}

export class LocalVectorStore {
  private vectors: Map<string, StoredVector> = new Map();
  private config: VectorStoreConfig;
  private dimensionality: number;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.dimensionality = config.dimensions;
    
    console.log(`🗂️ Initialized LocalVectorStore:`, {
      dimensions: config.dimensions,
      provider: config.provider
    });
  }

  /**
   * Add a chunk with its embedding to the vector store
   */
  async addChunk(chunk: DocumentChunk, embedding: number[]): Promise<void> {
    if (embedding.length !== this.dimensionality) {
      throw new RAGError(
        `Embedding dimension mismatch: expected ${this.dimensionality}, got ${embedding.length}`,
        RAGErrorCode.VECTOR_STORE_ERROR,
        { chunkId: chunk.id, embeddingLength: embedding.length },
        false
      );
    }

    const storedVector: StoredVector = {
      id: chunk.id,
      embedding: embedding,
      chunk: chunk,
      metadata: {
        documentId: chunk.documentId,
        documentType: chunk.metadata.section || 'unknown',
        tokenCount: chunk.metadata.tokenCount,
        importance: chunk.metadata.importance || 0.5,
        keywords: chunk.metadata.keywords || [],
        createdAt: new Date().toISOString()
      }
    };

    this.vectors.set(chunk.id, storedVector);
    
    console.log(`✅ Added chunk to vector store:`, {
      id: chunk.id,
      documentId: chunk.documentId,
      tokenCount: chunk.metadata.tokenCount,
      totalVectors: this.vectors.size
    });
  }

  /**
   * Add multiple chunks in batch
   */
  async addChunks(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new RAGError(
        `Chunks and embeddings count mismatch: ${chunks.length} vs ${embeddings.length}`,
        RAGErrorCode.VECTOR_STORE_ERROR,
        { chunksCount: chunks.length, embeddingsCount: embeddings.length },
        false
      );
    }

    const startTime = Date.now();
    const promises = chunks.map((chunk, index) => 
      this.addChunk(chunk, embeddings[index])
    );

    await Promise.all(promises);
    
    console.log(`🚀 Batch added ${chunks.length} chunks in ${Date.now() - startTime}ms`);
  }

  /**
   * Search for similar vectors
   */
  async search(query: VectorQuery): Promise<VectorSearchResult[]> {
    const startTime = Date.now();
    
    if (query.embedding.length !== this.dimensionality) {
      throw new RAGError(
        `Query embedding dimension mismatch: expected ${this.dimensionality}, got ${query.embedding.length}`,
        RAGErrorCode.SEARCH_ERROR,
        { embeddingLength: query.embedding.length },
        false
      );
    }

    const results: VectorSearchResult[] = [];
    const threshold = query.threshold || 0.0;

    // Calculate similarity for all vectors
    for (const storedVector of this.vectors.values()) {
      // Apply filters if specified
      if (query.filter && !this.matchesFilter(storedVector, query.filter)) {
        continue;
      }

      const similarity = this.cosineSimilarity(query.embedding, storedVector.embedding);
      const distance = 1 - similarity;

      if (similarity >= threshold) {
        results.push({
          chunk: storedVector.chunk,
          score: similarity,
          distance: distance
        });
      }
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limitedResults = results.slice(0, query.topK);
    
    const searchTime = Date.now() - startTime;
    console.log(`🔍 Vector search completed:`, {
      queryTime: searchTime,
      totalCandidates: this.vectors.size,
      matchingResults: results.length,
      returnedResults: limitedResults.length,
      topScore: limitedResults[0]?.score || 0
    });

    return limitedResults;
  }

  /**
   * Get chunk by ID
   */
  async getChunk(chunkId: string): Promise<DocumentChunk | null> {
    const storedVector = this.vectors.get(chunkId);
    return storedVector ? storedVector.chunk : null;
  }

  /**
   * Remove chunk by ID
   */
  async removeChunk(chunkId: string): Promise<boolean> {
    const deleted = this.vectors.delete(chunkId);
    if (deleted) {
      console.log(`🗑️ Removed chunk from vector store: ${chunkId}`);
    }
    return deleted;
  }

  /**
   * Remove all chunks for a document
   */
  async removeDocument(documentId: string): Promise<number> {
    let removedCount = 0;
    
    for (const [chunkId, storedVector] of this.vectors.entries()) {
      if (storedVector.chunk.documentId === documentId) {
        this.vectors.delete(chunkId);
        removedCount++;
      }
    }

    console.log(`🗑️ Removed ${removedCount} chunks for document: ${documentId}`);
    return removedCount;
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): {
    totalVectors: number;
    totalDocuments: number;
    averageTokensPerChunk: number;
    documentTypes: Record<string, number>;
  } {
    const documentIds = new Set<string>();
    const documentTypes: Record<string, number> = {};
    let totalTokens = 0;

    for (const storedVector of this.vectors.values()) {
      documentIds.add(storedVector.chunk.documentId);
      totalTokens += storedVector.chunk.metadata.tokenCount;
      
      const docType = storedVector.metadata.documentType || 'unknown';
      documentTypes[docType] = (documentTypes[docType] || 0) + 1;
    }

    return {
      totalVectors: this.vectors.size,
      totalDocuments: documentIds.size,
      averageTokensPerChunk: this.vectors.size > 0 ? totalTokens / this.vectors.size : 0,
      documentTypes
    };
  }

  /**
   * Clear all vectors
   */
  async clear(): Promise<void> {
    const count = this.vectors.size;
    this.vectors.clear();
    console.log(`🧹 Cleared ${count} vectors from store`);
  }

  /**
   * Export vectors for backup/migration
   */
  async exportVectors(): Promise<StoredVector[]> {
    return Array.from(this.vectors.values());
  }

  /**
   * Import vectors from backup
   */
  async importVectors(vectors: StoredVector[]): Promise<void> {
    this.vectors.clear();
    
    for (const vector of vectors) {
      this.vectors.set(vector.id, vector);
    }
    
    console.log(`📥 Imported ${vectors.length} vectors`);
  }

  // Private utility methods

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vector dimensions must match for similarity calculation');
    }

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

  /**
   * Check if a stored vector matches the given filters
   */
  private matchesFilter(storedVector: StoredVector, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const storedValue = storedVector.metadata[key] || storedVector.chunk.metadata[key as keyof typeof storedVector.chunk.metadata];
      
      if (Array.isArray(value)) {
        // Array filter - check if stored value is in array
        if (!value.includes(storedValue)) {
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Range filter for numbers
        if (typeof value.min === 'number' && storedValue < value.min) {
          return false;
        }
        if (typeof value.max === 'number' && storedValue > value.max) {
          return false;
        }
      } else {
        // Exact match
        if (storedValue !== value) {
          return false;
        }
      }
    }

    return true;
  }
}

/**
 * Advanced vector operations for better search results
 */
export class VectorOperations {
  /**
   * Implement Maximal Marginal Relevance (MMR) for diverse results
   */
  static applyMMR(
    results: VectorSearchResult[],
    queryEmbedding: number[],
    diversityWeight: number = 0.3
  ): VectorSearchResult[] {
    if (results.length <= 1) return results;

    const selected: VectorSearchResult[] = [];
    const remaining = [...results];

    // Always select the most relevant result first
    selected.push(remaining.shift()!);

    while (remaining.length > 0 && selected.length < results.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        
        // Relevance score (similarity to query)
        const relevanceScore = candidate.score;

        // Diversity score (minimum similarity to already selected items)
        let minSimilarity = Infinity;
        for (const selectedResult of selected) {
          const similarity = this.cosineSimilarity(
            candidate.chunk.embedding || [],
            selectedResult.chunk.embedding || []
          );
          minSimilarity = Math.min(minSimilarity, similarity);
        }

        // MMR score: balance relevance and diversity
        const mmrScore = (1 - diversityWeight) * relevanceScore + 
                        diversityWeight * (1 - minSimilarity);

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected;
  }

  /**
   * Re-rank results based on additional criteria
   */
  static rerank(
    results: VectorSearchResult[],
    criteria: {
      recencyWeight?: number;
      importanceWeight?: number;
      lengthWeight?: number;
    }
  ): VectorSearchResult[] {
    const {
      recencyWeight = 0.1,
      importanceWeight = 0.2,
      lengthWeight = 0.1
    } = criteria;

    return results.map(result => {
      let adjustedScore = result.score;

      // Adjust for importance
      if (result.chunk.metadata.importance) {
        adjustedScore += importanceWeight * result.chunk.metadata.importance;
      }

      // Adjust for content length (prefer substantial chunks)
      const tokenCount = result.chunk.metadata.tokenCount;
      const lengthScore = Math.min(tokenCount / 500, 1); // Normalize to 0-1
      adjustedScore += lengthWeight * lengthScore;

      return {
        ...result,
        score: Math.min(adjustedScore, 1.0) // Cap at 1.0
      };
    }).sort((a, b) => b.score - a.score);
  }

  private static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length === 0 || vectorB.length === 0) return 0;
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

/**
 * Factory function to create vector store based on configuration
 */
export function createVectorStore(config: VectorStoreConfig): LocalVectorStore {
  switch (config.provider) {
    case 'local':
      return new LocalVectorStore(config);
    
    case 'pinecone':
      // TODO: Implement Pinecone integration
      throw new RAGError(
        'Pinecone integration not yet implemented',
        RAGErrorCode.CONFIG_ERROR,
        { provider: config.provider },
        false
      );
    
    case 'weaviate':
      // TODO: Implement Weaviate integration
      throw new RAGError(
        'Weaviate integration not yet implemented',
        RAGErrorCode.CONFIG_ERROR,
        { provider: config.provider },
        false
      );
    
    default:
      throw new RAGError(
        `Unknown vector store provider: ${config.provider}`,
        RAGErrorCode.CONFIG_ERROR,
        { provider: config.provider },
        false
      );
  }
}
