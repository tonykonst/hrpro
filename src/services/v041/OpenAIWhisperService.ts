/**
 * НАСТОЯЩИЙ OpenAI Whisper API сервис
 * БЕЗ СИМУЛЯЦИЙ! Только реальные вызовы к OpenAI API
 */
export class OpenAIWhisperService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/audio/transcriptions';
  
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    console.log('🤖 OpenAI Whisper API service initialized (REAL API)');
  }

  /**
   * РЕАЛЬНАЯ транскрипция через OpenAI Whisper API
   */
  async transcribe(audioBlob: Blob, options?: {
    language?: string;
    prompt?: string;
    temperature?: number;
    response_format?: 'json' | 'verbose_json';
  }): Promise<{
    text: string;
    confidence: number;
    language: string;
    duration: number;
    segments?: any[];
    words?: any[];
  }> {
    const startTime = Date.now();
    
    try {
      // Создаем FormData для отправки аудио
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      
      // Параметры из архитектуры v0.41
      if (options?.language) {
        formData.append('language', options.language);
      }
      
      // Контекстный промпт для технических интервью
      const techPrompt = options?.prompt || 
        "This is a technical interview. Terms may include: API, React, TypeScript, Docker, Kubernetes, DevOps, CI/CD, machine learning, microservices, architecture, development.";
      formData.append('prompt', techPrompt);
      
      if (options?.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }
      
      // Запрашиваем детальный формат с timestamps
      formData.append('response_format', options?.response_format || 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');

      // РЕАЛЬНЫЙ вызов к OpenAI API
      console.log('📡 Making REAL call to OpenAI Whisper API...');
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Извлекаем данные из ответа OpenAI
      const text = result.text || '';
      const language = result.language || 'unknown';
      const duration = result.duration || 0;
      
      // Вычисляем confidence на основе segments (если доступны)
      let confidence = 0.9; // Базовая уверенность для Whisper
      if (result.segments && result.segments.length > 0) {
        const confidences = result.segments
          .filter((seg: any) => seg.avg_logprob !== undefined)
          .map((seg: any) => Math.exp(seg.avg_logprob));
        
        if (confidences.length > 0) {
          confidence = confidences.reduce((sum: number, conf: number) => sum + conf, 0) / confidences.length;
        }
      }

      const finalResult = {
        text: text.trim(),
        confidence,
        language,
        duration,
        segments: result.segments || [],
        words: result.words || []
      };

      console.log(`✅ REAL Whisper API result: "${text.substring(0, 50)}..." (${(confidence * 100).toFixed(1)}%, ${processingTime}ms)`);
      
      return finalResult;
      
    } catch (error) {
      console.error('❌ REAL Whisper API error:', error);
      throw new Error(`Whisper API failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Пакетная обработка нескольких аудио файлов
   */
  async transcribeBatch(audioBlobs: Blob[], options?: {
    language?: string;
    prompt?: string;
    concurrency?: number;
  }): Promise<Array<{
    text: string;
    confidence: number;
    language: string;
    duration: number;
    index: number;
  }>> {
    const concurrency = options?.concurrency || 3; // Максимум 3 одновременно
    const results: any[] = [];
    
    console.log(`🔄 Processing ${audioBlobs.length} audio files with REAL Whisper API (concurrency: ${concurrency})`);
    
    // Обрабатываем пакетами для контроля нагрузки
    for (let i = 0; i < audioBlobs.length; i += concurrency) {
      const batch = audioBlobs.slice(i, i + concurrency);
      const batchPromises = batch.map(async (blob, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const result = await this.transcribe(blob, options);
          return { ...result, index: globalIndex };
        } catch (error) {
          console.error(`❌ Batch item ${globalIndex} failed:`, error);
          return {
            text: `[Error: ${error}]`,
            confidence: 0.0,
            language: 'unknown',
            duration: 0,
            index: globalIndex
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Небольшая пауза между пакетами для API rate limits
      if (i + concurrency < audioBlobs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ REAL Whisper API batch completed: ${results.length} results`);
    return results;
  }

  /**
   * Проверка доступности API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Создаем минимальный тестовый аудио файл (1 секунда тишины в WAV)
      const silentAudio = this.createSilentWAV(1.0); // 1 секунда
      
      console.log('🔄 Testing REAL OpenAI Whisper API connection...');
      
      const result = await this.transcribe(silentAudio, {
        language: 'en',
        prompt: 'Test connection',
        temperature: 0.0
      });
      
      console.log('✅ REAL OpenAI Whisper API connection successful');
      return true;
      
    } catch (error) {
      console.error('❌ REAL OpenAI Whisper API connection failed:', error);
      return false;
    }
  }

  /**
   * Создает WAV файл с тишиной для тестирования
   */
  private createSilentWAV(durationSeconds: number): Blob {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    
    // WAV заголовок (44 байта) + аудио данные
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    
    // WAV заголовок
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
    view.setUint16(32, numChannels * bitsPerSample / 8, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    
    // Заполняем тишиной (все нули)
    // Данные уже инициализированы нулями в ArrayBuffer
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Получить информацию о модели
   */
  getModelInfo() {
    return {
      provider: 'OpenAI',
      model: 'whisper-1',
      type: 'cloud_api',
      cost_per_minute: 0.006, // $0.006 per minute
      max_file_size: '25MB',
      supported_formats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
      languages_supported: 99, // Whisper поддерживает 99 языков
      features: [
        'word_timestamps',
        'language_detection', 
        'context_prompts',
        'temperature_control'
      ]
    };
  }
}
