// Configuration Service - Centralized API keys and settings management
// Handles environment variables and fallback values

export interface ApiConfig {
  deepgram: {
    apiKey: string;
    model: string;
    language: string;
    punctuation: boolean;
    interimResults: boolean;
    smartFormat: boolean;
    endpointing: number;
    vadEvents: boolean;
    noDelay: boolean;
    interimResultsPeriod: number;
    keywords: string;
  };
  openai: {
    apiKey: string;
    whisperModel: string;
    temperature: number;
    language: string | null;
    prompt: string;
  };
  claude: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  postEditor: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    maxRequestsPerSecond: number;
    timeoutMs: number;
    enabled: boolean;
  };
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  chunkSize: number;
}

export interface UIConfig {
  insightFrequencyMs: number;
  minInsightConfidence: number;
  transcriptBufferWords: number;
  maxInsightsDisplay: number;
  defaultActivePanel: 'transcript' | 'insights' | 'settings';
  defaultClickThrough: boolean;
}

export interface AppConfig {
  api: ApiConfig;
  audio: AudioConfig;
  ui: UIConfig;
  isDevelopment: boolean;
}

class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
    
    if (this.config.isDevelopment) {
      console.log('🔧 Configuration loaded:', {
        deepgram_key: this.config.api.deepgram.apiKey ? '✅ Set' : '❌ Missing',
        claude_key: this.config.api.claude.apiKey ? '✅ Set' : '❌ Missing',
        environment: this.config.isDevelopment ? 'Development' : 'Production'
      });
    }
  }

  private loadConfig(): AppConfig {
    return {
      api: {
        deepgram: {
          apiKey: this.getEnvVar('DEEPGRAM_API_KEY', ''),
          model: 'nova-2-meeting', // ПРИНУДИТЕЛЬНО: специально для быстрой речи и совещаний
          language: '', // ПРИНУДИТЕЛЬНО: автоопределение языка
          punctuation: true, // ПРИНУДИТЕЛЬНО: включена
          interimResults: true, // ПРИНУДИТЕЛЬНО: включены
          smartFormat: true, // ПРИНУДИТЕЛЬНО: включен
          // Оптимизация для быстрой английской речи
          endpointing: 800, // ПРИНУДИТЕЛЬНО: больше времени для завершения фразы
          vadEvents: true, // ПРИНУДИТЕЛЬНО: Voice Activity Detection
          noDelay: true, // ПРИНУДИТЕЛЬНО: убрана буферизация
          interimResultsPeriod: 100, // ПРИНУДИТЕЛЬНО: чаще partial results
          keywords: this.getEnvVar('DEEPGRAM_KEYWORDS', this.getDefaultKeywords()), // IT-термины
        },
        openai: {
          apiKey: this.getEnvVar('OPENAI_API_KEY', ''),
          whisperModel: this.getEnvVar('OPENAI_WHISPER_MODEL', 'whisper-1'),
          temperature: parseFloat(this.getEnvVar('OPENAI_WHISPER_TEMPERATURE', '0.0')),
          language: this.getEnvVar('OPENAI_WHISPER_LANGUAGE', '') || null, // null для автодетекции
          prompt: this.getEnvVar('OPENAI_WHISPER_PROMPT', 'This is a technical interview. Terms may include: API, React, TypeScript, Docker, Kubernetes, DevOps, CI/CD, machine learning, microservices, architecture, development.')
        },
        claude: {
          apiKey: this.getEnvVar('CLAUDE_API_KEY', ''),
          model: this.getEnvVar('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),
          maxTokens: parseInt(this.getEnvVar('CLAUDE_MAX_TOKENS', '300')),
          temperature: parseFloat(this.getEnvVar('CLAUDE_TEMPERATURE', '0.3')),
        },
        postEditor: {
          apiKey: this.getEnvVar('POST_EDITOR_API_KEY', ''), // Can use same as Claude
          model: this.getEnvVar('POST_EDITOR_MODEL', 'claude-3-haiku-20240307'), // Fast model
          maxTokens: parseInt(this.getEnvVar('POST_EDITOR_MAX_TOKENS', '150')),
          temperature: parseFloat(this.getEnvVar('POST_EDITOR_TEMPERATURE', '0.1')), // Low for consistency
          maxRequestsPerSecond: parseFloat(this.getEnvVar('POST_EDITOR_MAX_RPS', '3')), // Увеличили с 1 до 3
          timeoutMs: parseInt(this.getEnvVar('POST_EDITOR_TIMEOUT_MS', '500')), // Увеличили с 250 до 500
          enabled: this.getEnvVar('POST_EDITOR_ENABLED', 'true') === 'true',
        }
      },
      audio: {
        sampleRate: parseInt(this.getEnvVar('AUDIO_SAMPLE_RATE', '16000')),
        channels: parseInt(this.getEnvVar('AUDIO_CHANNELS', '1')),
        echoCancellation: this.getEnvVar('AUDIO_ECHO_CANCELLATION', 'true') === 'true',
        noiseSuppression: this.getEnvVar('AUDIO_NOISE_SUPPRESSION', 'true') === 'true',
        autoGainControl: this.getEnvVar('AUDIO_AUTO_GAIN_CONTROL', 'true') === 'true',
        chunkSize: parseInt(this.getEnvVar('AUDIO_CHUNK_SIZE', '250')),
      },
      ui: {
        insightFrequencyMs: parseInt(this.getEnvVar('UI_INSIGHT_FREQUENCY_MS', '3000')),
        minInsightConfidence: parseFloat(this.getEnvVar('UI_MIN_INSIGHT_CONFIDENCE', '0.6')),
        transcriptBufferWords: parseInt(this.getEnvVar('UI_TRANSCRIPT_BUFFER_WORDS', '600')),
        maxInsightsDisplay: parseInt(this.getEnvVar('UI_MAX_INSIGHTS_DISPLAY', '3')),
        defaultActivePanel: this.getEnvVar('UI_DEFAULT_ACTIVE_PANEL', 'transcript') as 'transcript' | 'insights' | 'settings',
        defaultClickThrough: this.getEnvVar('UI_DEFAULT_CLICK_THROUGH', 'false') === 'true',
      },
      isDevelopment: this.getEnvVar('NODE_ENV', 'development') === 'development'
    };
  }

  private getEnvVar(key: string, defaultValue: string): string {
    // Fallback для development режима (если process.env доступен)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
    
    // Fallback для browser environment
    if (typeof window !== 'undefined' && (window as any).process?.env) {
      return (window as any).process.env[key] || defaultValue;
    }
    
    // В безопасном режиме Electron переменные окружения недоступны напрямую
    // Они будут переданы через electronAPI.getConfig() асинхронно
    console.warn(`⚠️ [CONFIG] Environment variable ${key} not available in secure mode, using default: ${defaultValue}`);
    return defaultValue;
  }

  private getDefaultKeywords(): string {
    // IT-термины с весами для лучшего распознавания
    const keywords = [
      'React:10', 'JavaScript:10', 'TypeScript:10', 'Node.js:10',
      'Python:10', 'Docker:10', 'Kubernetes:10', 'API:10',
      'frontend:8', 'backend:8', 'database:8', 'server:8',
      'component:6', 'function:6', 'method:6', 'class:6',
      'interface:6', 'service:6', 'controller:6', 'repository:6',
      'Angular:10', 'Vue:10', 'Svelte:8', 'Next.js:8',
      'Express:8', 'FastAPI:8', 'Django:8', 'Spring:8',
      'PostgreSQL:8', 'MongoDB:8', 'Redis:8', 'MySQL:8',
      'AWS:10', 'Azure:8', 'Google Cloud:8', 'Firebase:8',
      'Git:8', 'GitHub:8', 'GitLab:6', 'Bitbucket:6',
      'JWT:8', 'OAuth:8', 'REST:8', 'GraphQL:8',
      'microservices:6', 'serverless:6', 'DevOps:6', 'CI/CD:6'
    ];
    return keywords.join(',');
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Validate API keys if not in mock mode
    if (!this.config.api.deepgram.apiKey && !this.config.isDevelopment) {
      console.warn('⚠️ DEEPGRAM_API_KEY not configured - will use mock mode');
    }

    if (!this.config.api.claude.apiKey && !this.config.isDevelopment) {
      console.warn('⚠️ CLAUDE_API_KEY not configured - will use mock insights');
    }

    // Validate audio settings
    if (this.config.audio.sampleRate < 8000 || this.config.audio.sampleRate > 48000) {
      errors.push('AUDIO_SAMPLE_RATE must be between 8000 and 48000');
    }

    if (this.config.audio.channels < 1 || this.config.audio.channels > 2) {
      errors.push('AUDIO_CHANNELS must be 1 or 2');
    }

    // Validate UI settings
    if (this.config.ui.insightFrequencyMs < 1000) {
      errors.push('UI_INSIGHT_FREQUENCY_MS must be at least 1000ms');
    }

    if (this.config.ui.minInsightConfidence < 0 || this.config.ui.minInsightConfidence > 1) {
      errors.push('UI_MIN_INSIGHT_CONFIDENCE must be between 0 and 1');
    }

    if (errors.length > 0) {
      console.error('❌ Configuration validation errors:', errors);
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  // Public getters
  get api(): ApiConfig {
    return this.config.api;
  }

  get audio(): AudioConfig {
    return this.config.audio;
  }

  get ui(): UIConfig {
    return this.config.ui;
  }

  get isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  /**
   * Получить конфигурацию приложения
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Асинхронно получить конфигурацию с переменными окружения из electronAPI
   */
  async getConfigWithEnv(): Promise<AppConfig> {
    // Если electronAPI доступен, получаем переменные окружения
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const configData = await (window as any).electronAPI.getConfig();
        if (configData?.env) {
          // Обновляем конфигурацию с реальными переменными окружения
          this.config.api.deepgram.apiKey = configData.env.DEEPGRAM_API_KEY || this.config.api.deepgram.apiKey;
          this.config.api.claude.apiKey = configData.env.CLAUDE_API_KEY || this.config.api.claude.apiKey;
          this.config.api.openai.apiKey = configData.env.OPENAI_API_KEY || this.config.api.openai.apiKey;
          this.config.api.postEditor.apiKey = configData.env.POST_EDITOR_API_KEY || this.config.api.postEditor.apiKey;
          this.config.isDevelopment = configData.env.NODE_ENV === 'development';
          
          console.log('✅ [CONFIG] Environment variables loaded from electronAPI');
        }
      } catch (error) {
        console.warn('⚠️ [CONFIG] Failed to load environment variables from electronAPI:', error);
      }
    }
    
    return this.config;
  }

  // Check if services are configured
  isDeepgramConfigured(): boolean {
    return Boolean(this.config.api.deepgram.apiKey);
  }

  isOpenAIConfigured(): boolean {
    return Boolean(this.config.api.openai.apiKey);
  }

  isClaudeConfigured(): boolean {
    return Boolean(this.config.api.claude.apiKey);
  }

  isPostEditorConfigured(): boolean {
    return Boolean(this.config.api.postEditor.apiKey && this.config.api.postEditor.enabled);
  }

  // Get service-specific configs
  getDeepgramConfig() {
    return {
      apiKey: this.config.api.deepgram.apiKey,
      model: this.config.api.deepgram.model,
      language: this.config.api.deepgram.language,
      punctuation: this.config.api.deepgram.punctuation,
      interim_results: this.config.api.deepgram.interimResults,
      smart_format: this.config.api.deepgram.smartFormat,
      endpointing: this.config.api.deepgram.endpointing,
      vad_events: this.config.api.deepgram.vadEvents,
      no_delay: this.config.api.deepgram.noDelay,
      interim_results_period: this.config.api.deepgram.interimResultsPeriod,
      keywords: this.config.api.deepgram.keywords,
    };
  }

  getOpenAIConfig() {
    return {
      apiKey: this.config.api.openai.apiKey,
      whisperModel: this.config.api.openai.whisperModel,
      temperature: this.config.api.openai.temperature,
      language: this.config.api.openai.language,
      prompt: this.config.api.openai.prompt
    };
  }

  getClaudeConfig() {
    return {
      apiKey: this.config.api.claude.apiKey,
      model: this.config.api.claude.model,
      maxTokens: this.config.api.claude.maxTokens,
      temperature: this.config.api.claude.temperature,
    };
  }

  getPostEditorConfig() {
    return {
      apiKey: this.config.api.postEditor.apiKey || this.config.api.claude.apiKey, // Fallback to Claude key
      model: this.config.api.postEditor.model,
      maxTokens: this.config.api.postEditor.maxTokens,
      temperature: this.config.api.postEditor.temperature,
      maxRequestsPerSecond: this.config.api.postEditor.maxRequestsPerSecond,
      timeoutMs: this.config.api.postEditor.timeoutMs,
    };
  }

  getAudioConstraints() {
    return {
      audio: {
        sampleRate: this.config.audio.sampleRate,
        channelCount: this.config.audio.channels,
        echoCancellation: this.config.audio.echoCancellation,
        noiseSuppression: this.config.audio.noiseSuppression,
        autoGainControl: this.config.audio.autoGainControl,
      }
    };
  }

  // Development helpers
  logConfig(): void {
    if (this.config.isDevelopment) {
      console.table({
        'Deepgram API': this.isDeepgramConfigured() ? '✅ Configured' : '❌ Missing',
        'Claude API': this.isClaudeConfigured() ? '✅ Configured' : '❌ Missing',
        'Sample Rate': `${this.config.audio.sampleRate}Hz`,
        'Channels': this.config.audio.channels,
        'Insight Frequency': `${this.config.ui.insightFrequencyMs}ms`,
        'Environment': this.config.isDevelopment ? 'Development' : 'Production'
      });
    }
  }
}

// Singleton instance
export const configService = new ConfigService();

// Legacy exports for backward compatibility
export const getDeepgramConfig = () => configService.getDeepgramConfig();
export const getClaudeConfig = () => configService.getClaudeConfig();
export const getAudioConstraints = () => configService.getAudioConstraints();
