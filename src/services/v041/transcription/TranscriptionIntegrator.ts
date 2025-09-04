import { SmartBuffer, TranscriptionResult } from '../../../types/v041/buffering';
import { WhisperTranscriptionService } from './WhisperTranscriptionService';
import { SmartBufferManager } from '../buffering/SmartBufferManager';

/**
 * Интегратор транскрипции - связывает систему буферизации с Whisper
 * Реализует архитектуру v0.41 для нулевой потери слов
 */
export class TranscriptionIntegrator {
  private whisperService: WhisperTranscriptionService;
  private bufferManager: SmartBufferManager | null = null;
  private isActive = false;
  
  // Callbacks для уведомлений
  private onTranscriptionCallback?: (buffer: SmartBuffer, result: TranscriptionResult) => void;
  private onQualityUpdateCallback?: (metrics: QualityMetrics) => void;
  
  // Интервал проверки готовых буферов
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly checkInterval = 500; // 500ms
  
  // Метрики качества
  private qualityMetrics: QualityMetrics = {
    totalBuffersProcessed: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    wordsPreserved: 0,
    overlapQuality: 0,
    languageDistribution: new Map()
  };

  constructor() {
    this.whisperService = new WhisperTranscriptionService();
    console.log('🔗 TranscriptionIntegrator initialized');
  }

  /**
   * Подключает менеджер буферов
   */
  connectBufferManager(bufferManager: SmartBufferManager): void {
    this.bufferManager = bufferManager;
    console.log('🔌 Buffer manager connected to transcription integrator');
  }

  /**
   * Запускает интеграцию транскрипции
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('⚠️ Transcription integrator already active');
      return;
    }

    if (!this.bufferManager) {
      throw new Error('Buffer manager not connected');
    }

    try {
      // Инициализируем Whisper
      await this.whisperService.initialize();
      
      // Запускаем мониторинг буферов
      this.startBufferMonitoring();
      
      this.isActive = true;
      console.log('✅ Transcription integration started');
      
    } catch (error) {
      console.error('❌ Failed to start transcription integration:', error);
      throw error;
    }
  }

  /**
   * Останавливает интеграцию
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    console.log('🔄 Stopping transcription integration...');
    
    // Останавливаем мониторинг
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Завершаем работу Whisper
    await this.whisperService.shutdown();
    
    this.isActive = false;
    console.log('✅ Transcription integration stopped');
  }

  /**
   * Устанавливает callback для уведомлений о транскрипции
   */
  onTranscription(callback: (buffer: SmartBuffer, result: TranscriptionResult) => void): void {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Устанавливает callback для обновлений качества
   */
  onQualityUpdate(callback: (metrics: QualityMetrics) => void): void {
    this.onQualityUpdateCallback = callback;
  }

  /**
   * Запускает мониторинг готовых буферов
   */
  private startBufferMonitoring(): void {
    this.processingInterval = setInterval(() => {
      this.processReadyBuffers();
    }, this.checkInterval);
    
    console.log(`👀 Buffer monitoring started (check every ${this.checkInterval}ms)`);
  }

  /**
   * Обрабатывает готовые буферы
   */
  private async processReadyBuffers(): Promise<void> {
    if (!this.bufferManager) return;

    const readyBuffers = this.bufferManager.getReadyBuffers();
    const unprocessedBuffers = readyBuffers.filter(buffer => !buffer.transcription);
    
    if (unprocessedBuffers.length === 0) return;

    console.log(`📝 Processing ${unprocessedBuffers.length} ready buffers`);

    // Обрабатываем буферы параллельно (но ограниченно для стабильности)
    const maxConcurrent = 2;
    const batches = this.chunkArray(unprocessedBuffers, maxConcurrent);
    
    for (const batch of batches) {
      const promises = batch.map(buffer => this.processBuffer(buffer));
      await Promise.all(promises);
    }
  }

  /**
   * Обрабатывает отдельный буфер
   */
  private async processBuffer(buffer: SmartBuffer): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Транскрибируем буфер
      const result = await this.whisperService.transcribe(buffer);
      
      // Применяем пост-обработку для улучшения качества
      const enhancedResult = await this.enhanceTranscription(result, buffer);
      
      // Обновляем буфер
      buffer.transcription = enhancedResult;
      buffer.confidence = enhancedResult.confidence;
      
      // Обновляем метрики
      this.updateQualityMetrics(buffer, enhancedResult, Date.now() - startTime);
      
      // Уведомляем о готовности
      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(buffer, enhancedResult);
      }
      
      console.log(`✅ Buffer transcribed: ${buffer.id} (${(enhancedResult.confidence * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Failed to process buffer ${buffer.id}:`, error);
      
      // Создаем результат с ошибкой
      const errorResult: TranscriptionResult = {
        text: '[Processing Error]',
        confidence: 0.0,
        wordTimestamps: [],
        language: 'en',
        isDraft: false,
        processingTime: 0
      };
      
      buffer.transcription = errorResult;
      buffer.confidence = 0.0;
    }
  }

  /**
   * Улучшает результат транскрипции с помощью пост-обработки
   */
  private async enhanceTranscription(
    result: TranscriptionResult, 
    buffer: SmartBuffer
  ): Promise<TranscriptionResult> {
    // В будущем здесь будет интеграция с:
    // - Grammar correction (T5/mT5)
    // - Term validation
    // - Context-aware corrections
    
    // Пока просто возвращаем оригинальный результат
    return result;
  }

  /**
   * Обновляет метрики качества
   */
  private updateQualityMetrics(
    buffer: SmartBuffer, 
    result: TranscriptionResult, 
    processingTime: number
  ): void {
    this.qualityMetrics.totalBuffersProcessed++;
    
    // Обновляем среднюю уверенность
    const total = this.qualityMetrics.totalBuffersProcessed;
    this.qualityMetrics.averageConfidence = (
      (this.qualityMetrics.averageConfidence * (total - 1) + result.confidence) / total
    );
    
    // Обновляем среднее время обработки
    this.qualityMetrics.averageProcessingTime = (
      (this.qualityMetrics.averageProcessingTime * (total - 1) + processingTime) / total
    );
    
    // Подсчитываем сохраненные слова (на основе word timestamps)
    this.qualityMetrics.wordsPreserved += result.wordTimestamps.length;
    
    // Обновляем распределение языков
    const currentCount = this.qualityMetrics.languageDistribution.get(result.language) || 0;
    this.qualityMetrics.languageDistribution.set(result.language, currentCount + 1);
    
    // Вычисляем качество перекрытий
    if (this.bufferManager) {
      const overlaps = this.bufferManager.getBufferOverlaps();
      this.qualityMetrics.overlapQuality = this.calculateOverlapQuality(overlaps);
    }
    
    // Уведомляем о обновлении метрик
    if (this.onQualityUpdateCallback) {
      this.onQualityUpdateCallback(this.qualityMetrics);
    }
  }

  /**
   * Вычисляет качество перекрытий между буферами
   */
  private calculateOverlapQuality(overlaps: any[]): number {
    if (overlaps.length === 0) return 1.0;
    
    // Упрощенная метрика - в реальной реализации здесь будет
    // анализ совпадения слов в перекрывающихся областях
    return Math.min(1.0, overlaps.length / 10);
  }

  /**
   * Разбивает массив на чанки
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Получить текущие метрики качества
   */
  getQualityMetrics(): QualityMetrics {
    return { ...this.qualityMetrics };
  }

  /**
   * Получить статистику Whisper сервиса
   */
  getWhisperStats() {
    return this.whisperService.getStats();
  }

  /**
   * Проверить статус интеграции
   */
  getStatus() {
    return {
      isActive: this.isActive,
      bufferManagerConnected: !!this.bufferManager,
      whisperStats: this.whisperService.getStats(),
      qualityMetrics: this.qualityMetrics
    };
  }
}

// Интерфейс для метрик качества
export interface QualityMetrics {
  totalBuffersProcessed: number;
  averageConfidence: number;
  averageProcessingTime: number;
  wordsPreserved: number;
  overlapQuality: number;
  languageDistribution: Map<string, number>;
}
