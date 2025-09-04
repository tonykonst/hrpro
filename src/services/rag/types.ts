// RAG System Type Definitions
// Comprehensive types for Retrieval-Augmented Generation system

export interface Document {
  id: string;
  content: string;
  type: DocumentType;
  metadata: DocumentMetadata;
  chunks?: DocumentChunk[];
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentType = 
  | 'job_description'
  | 'resume'
  | 'knowledge_base'
  | 'interview_guide'
  | 'company_info';

export interface DocumentMetadata {
  title?: string;
  source?: string;
  author?: string;
  tags?: string[];
  language?: string;
  
  // Job Description specific
  position?: string;
  company?: string;
  requirements?: string[];
  skills?: string[];
  experience_level?: string;
  
  // Resume specific
  candidate_name?: string;
  candidate_email?: string;
  years_experience?: number;
  education?: string[];
  certifications?: string[];
  
  // General
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  chunkIndex: number;
  tokenCount: number;
  topic?: string;
  importance?: number; // 0-1 score
  keywords?: string[];
  section?: string; // e.g., "requirements", "experience", "skills"
}

// Vector Store Interfaces
export interface VectorStoreConfig {
  provider: 'local' | 'pinecone' | 'weaviate';
  dimensions: number;
  indexName?: string;
  namespace?: string;
}

export interface VectorSearchResult {
  chunk: DocumentChunk;
  score: number;
  distance: number;
}

export interface VectorQuery {
  embedding: number[];
  topK: number;
  threshold?: number;
  filter?: Record<string, any>;
}

// Embedding Interfaces
export interface EmbeddingConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  dimensions: number;
  batchSize: number;
  apiKey?: string;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// RAG Service Interfaces
export interface RAGConfig {
  vectorStore: VectorStoreConfig;
  embedding: EmbeddingConfig;
  retrieval: RetrievalConfig;
  chunking: ChunkingConfig;
}

export interface RetrievalConfig {
  topK: number;
  similarityThreshold: number;
  diversityWeight: number; // 0-1, for MMR (Maximal Marginal Relevance)
  contextWindowSize: number; // Max tokens in assembled context
  rerankingEnabled: boolean;
}

export interface ChunkingConfig {
  maxChunkSize: number; // In tokens
  overlapSize: number; // Overlap between chunks
  chunkingMethod: 'semantic' | 'fixed' | 'sentence' | 'paragraph';
  preserveStructure: boolean; // Keep headers, lists intact
}

// Context Assembly
export interface RAGContext {
  query: string;
  relevantChunks: ContextChunk[];
  totalTokens: number;
  sources: DocumentSource[];
  retrievalMetadata: RetrievalMetadata;
}

export interface ContextChunk {
  content: string;
  source: DocumentSource;
  relevanceScore: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface DocumentSource {
  documentId: string;
  type: DocumentType;
  title: string;
  metadata: DocumentMetadata;
}

export interface RetrievalMetadata {
  queryTime: number; // milliseconds
  totalCandidates: number;
  retrievedCount: number;
  averageScore: number;
  strategy: 'semantic' | 'hybrid' | 'keyword';
}

// Search and Ranking
export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface SearchFilters {
  documentTypes?: DocumentType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  topK?: number;
  threshold?: number;
  includeMetadata?: boolean;
  rerankResults?: boolean;
  diversityFactor?: number;
}

export interface SearchResult {
  chunks: VectorSearchResult[];
  metadata: RetrievalMetadata;
  suggestions?: string[]; // Query suggestions
}

// Context Optimization
export interface ContextOptimizer {
  maxTokens: number;
  priorityWeights: PriorityWeights;
  compressionEnabled: boolean;
  summaryEnabled: boolean;
}

export interface PriorityWeights {
  jobRequirements: number;
  candidateSkills: number;
  conversationHistory: number;
  generalKnowledge: number;
  recency: number; // Prefer recent information
}

// Performance Monitoring
export interface RAGMetrics {
  retrievalLatency: number;
  embeddingLatency: number;
  contextAssemblyLatency: number;
  totalLatency: number;
  
  retrievalPrecision?: number;
  retrievalRecall?: number;
  contextRelevance?: number;
  
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

// Error Handling
export interface RAGError extends Error {
  code: RAGErrorCode;
  context?: Record<string, any>;
  retriable: boolean;
}

export enum RAGErrorCode {
  DOCUMENT_PARSE_ERROR = 'DOCUMENT_PARSE_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  VECTOR_STORE_ERROR = 'VECTOR_STORE_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  CONTEXT_ASSEMBLY_ERROR = 'CONTEXT_ASSEMBLY_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

// Integration with Claude Service
export interface EnhancedAnalysisRequest {
  transcript: string;
  ragContext: RAGContext;
  interviewContext: InterviewContext;
}

export interface InterviewContext {
  position: string;
  candidateName?: string;
  interviewStage: 'screening' | 'technical' | 'behavioral' | 'final';
  duration: number; // minutes elapsed
  previousTopics: string[];
  skillsAssessed: string[];
}

// Configuration Management
export interface RAGServiceConfig extends RAGConfig {
  dataPath: string; // Path to document storage
  cacheEnabled: boolean;
  cacheTTL: number; // Cache time-to-live in seconds
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
}

// Batch Operations
export interface BatchProcessRequest {
  documents: Document[];
  options: BatchProcessOptions;
}

export interface BatchProcessOptions {
  concurrency: number;
  skipExisting: boolean;
  validateContent: boolean;
  generateSummaries: boolean;
}

export interface BatchProcessResult {
  processed: number;
  failed: number;
  errors: Array<{ documentId: string; error: string }>;
  duration: number;
}

// Export utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Default configurations
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  vectorStore: {
    provider: 'local',
    dimensions: 1536
  },
  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    batchSize: 100
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    diversityWeight: 0.3,
    contextWindowSize: 4000,
    rerankingEnabled: true
  },
  chunking: {
    maxChunkSize: 800,
    overlapSize: 100,
    chunkingMethod: 'semantic',
    preserveStructure: true
  }
};

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  jobRequirements: 0.4,
  candidateSkills: 0.3,
  conversationHistory: 0.2,
  generalKnowledge: 0.05,
  recency: 0.05
};
