// RAG System - Main Exports
// Centralized exports for the Retrieval-Augmented Generation system

// Main service
export { RAGService, createRAGService, RAGServiceBuilder } from './rag-service';

// Core components
export { DocumentProcessor } from './document-processor';
export { EmbeddingService, createEmbeddingService, EmbeddingUtils } from './embeddings';
export { LocalVectorStore, createVectorStore, VectorOperations } from './vector-store';

// Types and interfaces
export * from './types';
import { RAGErrorCode } from './types';
import { RAGService } from './rag-service';

// Utility functions and helpers
export {
  // Document processing utilities
} from './document-processor';

export {
  // Embedding utilities
} from './embeddings';

export {
  // Vector store utilities
} from './vector-store';


// Configuration presets
export const RAG_PRESETS = {
  // Development preset - fast local processing
  DEVELOPMENT: {
    embedding: {
      provider: 'local' as const,
      model: 'local-dev',
      dimensions: 384,
      batchSize: 50
    },
    vectorStore: {
      provider: 'local' as const,
      dimensions: 384
    },
    chunking: {
      maxChunkSize: 500,
      overlapSize: 50,
      chunkingMethod: 'fixed' as const,
      preserveStructure: false
    },
    retrieval: {
      topK: 3,
      similarityThreshold: 0.6,
      diversityWeight: 0.2,
      contextWindowSize: 2000,
      rerankingEnabled: false
    }
  },

  // Production preset - high quality with OpenAI
  PRODUCTION: {
    embedding: {
      provider: 'openai' as const,
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 100
    },
    vectorStore: {
      provider: 'local' as const,
      dimensions: 1536
    },
    chunking: {
      maxChunkSize: 800,
      overlapSize: 100,
      chunkingMethod: 'semantic' as const,
      preserveStructure: true
    },
    retrieval: {
      topK: 5,
      similarityThreshold: 0.7,
      diversityWeight: 0.3,
      contextWindowSize: 4000,
      rerankingEnabled: true
    }
  },

  // High performance preset - optimized for speed
  HIGH_PERFORMANCE: {
    embedding: {
      provider: 'openai' as const,
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 200
    },
    vectorStore: {
      provider: 'local' as const,
      dimensions: 1536
    },
    chunking: {
      maxChunkSize: 1000,
      overlapSize: 50,
      chunkingMethod: 'fixed' as const,
      preserveStructure: false
    },
    retrieval: {
      topK: 3,
      similarityThreshold: 0.75,
      diversityWeight: 0.1,
      contextWindowSize: 3000,
      rerankingEnabled: false
    }
  },

  // High quality preset - optimized for relevance
  HIGH_QUALITY: {
    embedding: {
      provider: 'openai' as const,
      model: 'text-embedding-3-large',
      dimensions: 3072,
      batchSize: 50
    },
    vectorStore: {
      provider: 'local' as const,
      dimensions: 3072
    },
    chunking: {
      maxChunkSize: 600,
      overlapSize: 150,
      chunkingMethod: 'semantic' as const,
      preserveStructure: true
    },
    retrieval: {
      topK: 7,
      similarityThreshold: 0.65,
      diversityWeight: 0.4,
      contextWindowSize: 5000,
      rerankingEnabled: true
    }
  }
} as const;

// Quick setup functions
export function createQuickRAGService(
  preset: keyof typeof RAG_PRESETS,
  apiKey?: string
): RAGService {
  const config = { ...RAG_PRESETS[preset] };
  
  if (apiKey && config.embedding.provider === 'openai') {
    (config.embedding as any).apiKey = apiKey;
  }

  return new RAGService(config);
}

// Utility function to validate RAG configuration
export function validateRAGConfig(config: Partial<import('./types').RAGConfig>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check embedding configuration
  if (config.embedding) {
    if (config.embedding.provider === 'openai' && !config.embedding.apiKey) {
      errors.push('OpenAI API key is required for OpenAI embedding provider');
    }

    if (config.embedding.dimensions < 100) {
      warnings.push('Very low embedding dimensions may reduce quality');
    }

    if (config.embedding.batchSize > 1000) {
      warnings.push('Large batch sizes may cause API rate limiting');
    }
  }

  // Check chunking configuration
  if (config.chunking) {
    if (config.chunking.maxChunkSize > 2000) {
      warnings.push('Large chunk sizes may reduce retrieval precision');
    }

    if (config.chunking.overlapSize >= config.chunking.maxChunkSize) {
      errors.push('Overlap size must be smaller than chunk size');
    }
  }

  // Check retrieval configuration
  if (config.retrieval) {
    if (config.retrieval.topK > 20) {
      warnings.push('Large topK values may include irrelevant results');
    }

    if (config.retrieval.similarityThreshold < 0.5) {
      warnings.push('Low similarity threshold may include irrelevant results');
    }

    if (config.retrieval.contextWindowSize > 8000) {
      warnings.push('Large context windows may exceed LLM token limits');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper function to estimate token usage
export function estimateTokenUsage(
  documentCount: number,
  averageDocumentSize: number,
  chunkSize: number = 800
): {
  estimatedChunks: number;
  estimatedTokens: number;
  estimatedCost: {
    openai_small: number; // USD
    openai_large: number; // USD
  };
} {
  const totalCharacters = documentCount * averageDocumentSize;
  const estimatedChunks = Math.ceil(totalCharacters / (chunkSize * 4)); // 4 chars per token estimate
  const estimatedTokens = estimatedChunks * (chunkSize / 4);

  // OpenAI pricing estimates (as of 2024)
  const openaiSmallCostPerToken = 0.00002 / 1000; // $0.02 per 1K tokens
  const openaiLargeCostPerToken = 0.00013 / 1000; // $0.13 per 1K tokens

  return {
    estimatedChunks,
    estimatedTokens,
    estimatedCost: {
      openai_small: estimatedTokens * openaiSmallCostPerToken,
      openai_large: estimatedTokens * openaiLargeCostPerToken
    }
  };
}

// Performance monitoring utilities
export class RAGPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count,
      average: sum / count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(count * 0.95)]
    };
  }

  getAllStats(): Record<string, ReturnType<RAGPerformanceMonitor['getStats']>> {
    const stats: Record<string, ReturnType<RAGPerformanceMonitor['getStats']>> = {};
    for (const name of this.metrics.keys()) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  reset(): void {
    this.metrics.clear();
  }
}

// Create global performance monitor instance
export const ragPerformanceMonitor = new RAGPerformanceMonitor();

// Error handling utilities
export function isRAGError(error: any): error is import('./types').RAGError {
  return error && error.code && Object.values(RAGErrorCode).includes(error.code);
}

export function handleRAGError(error: unknown, context?: Record<string, any>): {
  message: string;
  code: string;
  retriable: boolean;
  context?: Record<string, any>;
} {
  if (isRAGError(error)) {
    return {
      message: error.message,
      code: error.code,
      retriable: error.retriable,
      context: { ...error.context, ...context }
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unknown error',
    code: 'UNKNOWN_ERROR',
    retriable: false,
    context
  };
}

// Migration utilities for future versions
export class RAGMigrationHelper {
  static async migrateFromV1(oldData: any): Promise<any> {
    // Placeholder for future migration logic
    console.warn('RAG migration from V1 not yet implemented');
    return oldData;
  }

  static async exportForMigration(ragService: RAGService): Promise<any> {
    const stats = ragService.getStats();
    const documents = ragService.listDocuments();
    
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      stats,
      documents: documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        metadata: doc.metadata,
        content: doc.content
      }))
    };
  }
}

// Development utilities
export const RAGDevUtils = {
  /**
   * Create a RAG service with sample data for testing
   */
  async createWithSampleData(): Promise<RAGService> {
    const ragService = createQuickRAGService('DEVELOPMENT');

    // Add sample job description
    await ragService.addDocument(
      `Senior Frontend Developer Position
      
      We are looking for an experienced Frontend Developer with expertise in React, TypeScript, and modern web technologies.
      
      Requirements:
      - 5+ years of experience with React
      - Strong TypeScript skills
      - Experience with state management (Redux, Zustand)
      - Knowledge of testing frameworks (Jest, React Testing Library)
      - Experience with build tools (Webpack, Vite)
      
      Responsibilities:
      - Develop responsive web applications
      - Collaborate with design and backend teams
      - Write maintainable, tested code
      - Mentor junior developers`,
      'job_description',
      {
        position: 'Senior Frontend Developer',
        company: 'TechCorp',
        skills: ['React', 'TypeScript', 'Redux', 'Jest'],
        experience_level: '5+ years'
      }
    );

    // Add sample resume
    await ragService.addDocument(
      `John Doe
      john.doe@email.com
      
      Experience:
      Senior Frontend Developer at WebCorp (2020-2024)
      - Led development of React applications with TypeScript
      - Implemented state management using Redux Toolkit
      - Built comprehensive test suites with Jest and RTL
      - Mentored 3 junior developers
      
      Frontend Developer at StartupInc (2018-2020)
      - Developed responsive web applications
      - Worked with React, JavaScript, and CSS
      - Collaborated with UX designers
      
      Skills:
      - React, TypeScript, JavaScript
      - Redux, Zustand, Context API
      - Jest, React Testing Library, Cypress
      - Webpack, Vite, CSS-in-JS
      - Git, CI/CD, Agile methodologies`,
      'resume',
      {
        candidate_name: 'John Doe',
        candidate_email: 'john.doe@email.com',
        years_experience: 6,
        skills: ['React', 'TypeScript', 'Redux', 'Jest', 'Cypress']
      }
    );

    console.log('🎭 RAG Service created with sample data');
    return ragService;
  },

  /**
   * Log detailed system information
   */
  logSystemInfo(ragService: RAGService): void {
    const stats = ragService.getStats();
    console.log('📊 RAG System Stats:', {
      documents: stats.documents,
      chunks: stats.chunks,
      totalTokens: stats.totalTokens,
      documentTypes: stats.documentTypes,
      vectorStore: stats.vectorStoreStats
    });
  }
};
