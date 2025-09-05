// Main RAG Service
// Orchestrates document processing, embedding generation, and context retrieval

import { DocumentProcessor } from './document-processor';
import { EmbeddingService, createEmbeddingService } from './embeddings';
import { LocalVectorStore, createVectorStore, VectorOperations } from './vector-store';
import {
  Document,
  DocumentType,
  DocumentMetadata,
  RAGConfig,
  RAGContext,
  SearchQuery,
  SearchResult,
  ContextChunk,
  DocumentSource,
  RetrievalMetadata,
  RAGMetrics,
  RAGError,
  RAGErrorCode,
  DEFAULT_RAG_CONFIG
} from './types';

export class RAGService {
  private config: RAGConfig;
  private documentProcessor: DocumentProcessor;
  private embeddingService: EmbeddingService;
  private vectorStore: LocalVectorStore;
  private documents: Map<string, Document> = new Map();

  constructor(config: Partial<RAGConfig> = {}) {
    // Merge with defaults
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };
    
    // Initialize components
    this.documentProcessor = new DocumentProcessor(this.config.chunking);
    this.embeddingService = createEmbeddingService(this.config.embedding);
    this.vectorStore = createVectorStore(this.config.vectorStore);

    console.log('🚀 RAG Service initialized:', {
      embeddingProvider: this.config.embedding.provider,
      embeddingModel: this.config.embedding.model,
      vectorStore: this.config.vectorStore.provider,
      chunkingMethod: this.config.chunking.chunkingMethod,
      maxChunkSize: this.config.chunking.maxChunkSize
    });
  }

  /**
   * Add a document to the RAG system
   */
  async addDocument(
    content: string,
    type: DocumentType,
    metadata: DocumentMetadata = {}
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`📄 Adding ${type} document:`, {
        contentLength: content.length,
        title: metadata.title || 'Untitled'
      });

      // Process document (parse, clean, chunk)
      const document = await this.documentProcessor.processDocument(content, type, metadata);
      
      // Store document
      this.documents.set(document.id, document);

      // Generate embeddings for all chunks
      const chunkTexts = document.chunks!.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

      // Add chunks to vector store
      await this.vectorStore.addChunks(document.chunks!, embeddings);

      // Store embeddings in chunks for later use
      document.chunks!.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Document added successfully:`, {
        documentId: document.id,
        chunks: document.chunks!.length,
        totalTokens: document.chunks!.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0),
        duration: `${duration}ms`
      });

      return document.id;

    } catch (error) {
      console.error('❌ Failed to add document:', error);
      
      if (error instanceof RAGError) {
        throw error;
      }
      
      throw new RAGError(
        `Failed to add document: ${error instanceof Error ? error.message : String(error)}`,
        RAGErrorCode.DOCUMENT_PARSE_ERROR,
        { type, contentLength: content.length },
        true
      );
    }
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(documents: Array<{
    content: string;
    type: DocumentType;
    metadata?: DocumentMetadata;
  }>): Promise<string[]> {
    const documentIds: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    console.log(`📚 Adding ${documents.length} documents in batch...`);

    for (let i = 0; i < documents.length; i++) {
      try {
        const { content, type, metadata = {} } = documents[i];
        const documentId = await this.addDocument(content, type, metadata);
        documentIds.push(documentId);
      } catch (error) {
        console.error(`❌ Failed to add document ${i}:`, error);
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
        documentIds.push(''); // Placeholder for failed document
      }
    }

    console.log(`📚 Batch processing completed:`, {
      total: documents.length,
      successful: documentIds.filter(id => id).length,
      failed: errors.length
    });

    if (errors.length > 0) {
      console.warn('⚠️ Some documents failed to process:', errors);
    }

    return documentIds;
  }

  /**
   * Get relevant context for a query
   */
  async getRelevantContext(
    query: string,
    options: {
      types?: DocumentType[];
      maxTokens?: number;
      topK?: number;
      threshold?: number;
      enableMMR?: boolean;
    } = {}
  ): Promise<RAGContext> {
    const startTime = Date.now();
    
    const {
      types,
      maxTokens = this.config.retrieval.contextWindowSize,
      topK = this.config.retrieval.topK,
      threshold = this.config.retrieval.similarityThreshold,
      enableMMR = true
    } = options;

    try {
      console.log(`🔍 Retrieving context for query:`, {
        queryLength: query.length,
        maxTokens,
        topK,
        threshold,
        filterTypes: types
      });

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Search vector store
      const searchResults = await this.vectorStore.search({
        embedding: queryEmbedding,
        topK: Math.max(topK * 2, 10), // Get more candidates for MMR
        threshold,
        filter: types ? { documentType: types } : undefined
      });

      // Apply MMR for diversity if enabled
      let finalResults = searchResults;
      if (enableMMR && searchResults.length > 1) {
        finalResults = VectorOperations.applyMMR(
          searchResults,
          queryEmbedding,
          this.config.retrieval.diversityWeight
        );
      }

      // Limit to requested topK
      finalResults = finalResults.slice(0, topK);

      // Re-rank results based on additional criteria
      finalResults = VectorOperations.rerank(finalResults, {
        recencyWeight: 0.1,
        importanceWeight: 0.2,
        lengthWeight: 0.1
      });

      // Assemble context chunks
      const contextChunks = await this.assembleContextChunks(finalResults, maxTokens);
      
      // Create document sources
      const sources = this.createDocumentSources(contextChunks);

      // Create retrieval metadata
      const retrievalMetadata: RetrievalMetadata = {
        queryTime: Date.now() - startTime,
        totalCandidates: await this.getTotalChunkCount(),
        retrievedCount: contextChunks.length,
        averageScore: contextChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / contextChunks.length || 0,
        strategy: enableMMR ? 'semantic' : 'semantic'
      };

      const ragContext: RAGContext = {
        query,
        relevantChunks: contextChunks,
        totalTokens: contextChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        sources,
        retrievalMetadata
      };

      console.log(`✅ Context retrieved:`, {
        chunks: contextChunks.length,
        totalTokens: ragContext.totalTokens,
        avgRelevance: retrievalMetadata.averageScore.toFixed(3),
        duration: `${retrievalMetadata.queryTime}ms`
      });

      return ragContext;

    } catch (error) {
      console.error('❌ Context retrieval failed:', error);
      
      if (error instanceof RAGError) {
        throw error;
      }
      
      throw new RAGError(
        `Context retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        RAGErrorCode.SEARCH_ERROR,
        { query: query.substring(0, 100) },
        true
      );
    }
  }

  /**
   * Search documents with advanced options
   */
  async search(searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.text);
      
      const vectorResults = await this.vectorStore.search({
        embedding: queryEmbedding,
        topK: searchQuery.options?.topK || this.config.retrieval.topK,
        threshold: searchQuery.options?.threshold || this.config.retrieval.similarityThreshold,
        filter: this.buildSearchFilter(searchQuery.filters)
      });

      const metadata: RetrievalMetadata = {
        queryTime: Date.now() - startTime,
        totalCandidates: await this.getTotalChunkCount(),
        retrievedCount: vectorResults.length,
        averageScore: vectorResults.reduce((sum, result) => sum + result.score, 0) / vectorResults.length || 0,
        strategy: 'semantic'
      };

      return {
        chunks: vectorResults,
        metadata,
        suggestions: this.generateQuerySuggestions(searchQuery.text, vectorResults)
      };

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw new RAGError(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        RAGErrorCode.SEARCH_ERROR,
        { query: searchQuery.text },
        true
      );
    }
  }

  /**
   * Remove a document and all its chunks
   */
  async removeDocument(documentId: string): Promise<boolean> {
    try {
      const document = this.documents.get(documentId);
      if (!document) {
        console.warn(`⚠️ Document not found: ${documentId}`);
        return false;
      }

      // Remove from vector store
      const removedChunks = await this.vectorStore.removeDocument(documentId);
      
      // Remove from document store
      this.documents.delete(documentId);

      console.log(`🗑️ Document removed:`, {
        documentId,
        removedChunks,
        title: document.metadata.title
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to remove document:', error);
      throw new RAGError(
        `Failed to remove document: ${error instanceof Error ? error.message : String(error)}`,
        RAGErrorCode.VECTOR_STORE_ERROR,
        { documentId },
        true
      );
    }
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): Document | null {
    return this.documents.get(documentId) || null;
  }

  /**
   * List all documents
   */
  listDocuments(type?: DocumentType): Document[] {
    const documents = Array.from(this.documents.values());
    return type ? documents.filter(doc => doc.type === type) : documents;
  }

  /**
   * Get system statistics
   */
  getStats(): {
    documents: number;
    chunks: number;
    totalTokens: number;
    documentTypes: Record<string, number>;
    vectorStoreStats: any;
  } {
    const documents = Array.from(this.documents.values());
    const documentTypes: Record<string, number> = {};
    let totalTokens = 0;
    let totalChunks = 0;

    for (const document of documents) {
      documentTypes[document.type] = (documentTypes[document.type] || 0) + 1;
      if (document.chunks) {
        totalChunks += document.chunks.length;
        totalTokens += document.chunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0);
      }
    }

    return {
      documents: documents.length,
      chunks: totalChunks,
      totalTokens,
      documentTypes,
      vectorStoreStats: this.vectorStore.getStats()
    };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear();
    this.documents.clear();
    console.log('🧹 RAG Service cleared');
  }

  // Private helper methods

  private async assembleContextChunks(
    searchResults: Array<{ chunk: any; score: number; distance: number }>,
    maxTokens: number
  ): Promise<ContextChunk[]> {
    const contextChunks: ContextChunk[] = [];
    let currentTokens = 0;

    for (const result of searchResults) {
      const chunk = result.chunk;
      const tokenCount = chunk.metadata.tokenCount;

      if (currentTokens + tokenCount > maxTokens && contextChunks.length > 0) {
        break; // Stop if adding this chunk would exceed token limit
      }

      const document = this.documents.get(chunk.documentId);
      if (!document) continue;

      const contextChunk: ContextChunk = {
        content: chunk.content,
        source: {
          documentId: document.id,
          type: document.type,
          title: document.metadata.title || 'Untitled',
          metadata: document.metadata
        },
        relevanceScore: result.score,
        tokenCount,
        metadata: chunk.metadata
      };

      contextChunks.push(contextChunk);
      currentTokens += tokenCount;
    }

    return contextChunks;
  }

  private createDocumentSources(contextChunks: ContextChunk[]): DocumentSource[] {
    const sourceMap = new Map<string, DocumentSource>();

    for (const chunk of contextChunks) {
      if (!sourceMap.has(chunk.source.documentId)) {
        sourceMap.set(chunk.source.documentId, chunk.source);
      }
    }

    return Array.from(sourceMap.values());
  }

  private async getTotalChunkCount(): Promise<number> {
    return this.vectorStore.getStats().totalVectors;
  }

  private buildSearchFilter(filters: any): Record<string, any> | undefined {
    if (!filters) return undefined;

    const filter: Record<string, any> = {};

    if (filters.documentTypes) {
      filter.documentType = filters.documentTypes;
    }

    if (filters.tags) {
      filter.tags = filters.tags;
    }

    if (filters.metadata) {
      Object.assign(filter, filters.metadata);
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  private generateQuerySuggestions(query: string, results: any[]): string[] {
    // Simple query suggestion generation
    const suggestions: string[] = [];
    
    if (results.length === 0) {
      suggestions.push(
        'Try using different keywords',
        'Check for spelling errors',
        'Use more general terms'
      );
    } else if (results.length < 3) {
      suggestions.push(
        'Try broader search terms',
        'Remove specific details'
      );
    }

    return suggestions;
  }
}

/**
 * Factory function to create RAG service
 */
export function createRAGService(config: Partial<RAGConfig> = {}): RAGService {
  return new RAGService(config);
}

/**
 * RAG Service Builder for easy configuration
 */
export class RAGServiceBuilder {
  private config: Partial<RAGConfig> = {};

  withEmbedding(provider: 'openai' | 'local', model: string, apiKey?: string): this {
    this.config.embedding = {
      provider,
      model,
      dimensions: provider === 'openai' ? 1536 : 384,
      batchSize: 100,
      apiKey
    };
    return this;
  }

  withVectorStore(provider: 'local', dimensions?: number): this {
    this.config.vectorStore = {
      provider,
      dimensions: dimensions || this.config.embedding?.dimensions || 1536
    };
    return this;
  }

  withChunking(
    method: 'semantic' | 'fixed' | 'sentence' | 'paragraph',
    maxSize: number = 800,
    overlap: number = 100
  ): this {
    this.config.chunking = {
      maxChunkSize: maxSize,
      overlapSize: overlap,
      chunkingMethod: method,
      preserveStructure: true
    };
    return this;
  }

  withRetrieval(topK: number = 5, threshold: number = 0.7, diversityWeight: number = 0.3): this {
    this.config.retrieval = {
      topK,
      similarityThreshold: threshold,
      diversityWeight,
      contextWindowSize: 4000,
      rerankingEnabled: true
    };
    return this;
  }

  build(): RAGService {
    return new RAGService(this.config);
  }
}
