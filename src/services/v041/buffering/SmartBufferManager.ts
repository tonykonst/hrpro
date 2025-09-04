import { 
  SmartBuffer, 
  BufferConfig, 
  SpeechSegment, 
  BufferOverlap,
  WordMatch,
  VADResult 
} from '../../../types/v041/buffering';

/**
 * Интеллектуальная система буферизации с нулевой потерей слов
 * Основана на адаптивной перекрывающейся буферизации
 */
export class SmartBufferManager {
  private config: BufferConfig;
  private buffers: Map<string, SmartBuffer> = new Map();
  private currentBuffer: SmartBuffer | null = null;
  private audioContext: AudioContext;
  private sampleRate: number;
  private isRecording = false;
  
  // Статистика для адаптации
  private averageSpeechRate = 150; // слов в минуту
  private recentSilenceDurations: number[] = [];
  
  constructor(config: BufferConfig, audioContext: AudioContext) {
    this.config = {
      baseWindowSize: 30,
      overlapSize: 8,
      adaptToSpeechRate: true,
      extendOnActiveSpeech: true,
      silenceThreshold: 0.5,
      energyThreshold: 0.1,
      preSpeechBuffer: 0.5,
      postSpeechBuffer: 1.0,
      ...config
    };
    
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    console.log('🎯 SmartBufferManager initialized:', {
      windowSize: this.config.baseWindowSize,
      overlap: this.config.overlapSize,
      sampleRate: this.sampleRate
    });
  }

  /**
   * Начинает буферизацию аудиопотока
   */
  startBuffering(): void {
    this.isRecording = true;
    this.createNewBuffer();
    console.log('▶️ Smart buffering started');
  }

  /**
   * Останавливает буферизацию
   */
  stopBuffering(): void {
    this.isRecording = false;
    if (this.currentBuffer && !this.currentBuffer.isProcessed) {
      this.finalizeBuffer(this.currentBuffer);
    }
    console.log('⏹️ Smart buffering stopped');
  }

  /**
   * Добавляет аудио чанк в текущий буфер
   */
  addAudioChunk(audioChunk: Float32Array, vadResult: VADResult): void {
    if (!this.isRecording || !this.currentBuffer) {
      return;
    }

    // Расширяем буфер новыми данными
    const newAudioData = new Float32Array(
      this.currentBuffer.audioData.length + audioChunk.length
    );
    newAudioData.set(this.currentBuffer.audioData);
    newAudioData.set(audioChunk, this.currentBuffer.audioData.length);
    
    this.currentBuffer.audioData = newAudioData;
    this.currentBuffer.endTime = this.getCurrentTime();
    this.currentBuffer.duration = this.currentBuffer.endTime - this.currentBuffer.startTime;

    // Проверяем, нужно ли создать новый буфер
    this.checkBufferSegmentation(vadResult);
  }

  /**
   * Проверяет, нужно ли сегментировать буфер
   */
  private checkBufferSegmentation(vadResult: VADResult): void {
    if (!this.currentBuffer) return;

    const shouldSegment = this.shouldCreateNewBuffer(vadResult);
    
    if (shouldSegment) {
      this.finalizeCurrentBufferAndCreateNew();
    }
  }

  /**
   * Определяет, нужно ли создать новый буфер
   */
  private shouldCreateNewBuffer(vadResult: VADResult): boolean {
    if (!this.currentBuffer) return true;

    const duration = this.currentBuffer.duration;
    const baseSize = this.getAdaptiveWindowSize();

    // 1. Превышен базовый размер окна
    if (duration >= baseSize) {
      return true;
    }

    // 2. Обнаружена пауза достаточной длительности
    if (!vadResult.isSpeech && this.isLongSilence()) {
      return true;
    }

    // 3. Низкая энергия сигнала (тишина)
    if (vadResult.energyLevel < this.config.energyThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Адаптивный размер окна на основе скорости речи
   */
  private getAdaptiveWindowSize(): number {
    if (!this.config.adaptToSpeechRate) {
      return this.config.baseWindowSize;
    }

    // Если речь быстрая - увеличиваем окно для лучшего контекста
    // Если медленная - уменьшаем для быстрой обработки
    const speedFactor = this.averageSpeechRate / 150; // 150 wpm - средняя скорость
    const adaptiveSize = this.config.baseWindowSize * (0.8 + speedFactor * 0.4);
    
    return Math.max(20, Math.min(45, adaptiveSize)); // Ограничиваем 20-45 секунд
  }

  /**
   * Проверяет длительность тишины
   */
  private isLongSilence(): boolean {
    // Простая проверка - в реальной реализации нужен анализ последних чанков
    return this.recentSilenceDurations.length > 0 && 
           this.recentSilenceDurations[this.recentSilenceDurations.length - 1] > this.config.silenceThreshold;
  }

  /**
   * Завершает текущий буфер и создает новый с перекрытием
   */
  private finalizeCurrentBufferAndCreateNew(): void {
    if (!this.currentBuffer) return;

    const finalizingBuffer = this.currentBuffer;
    
    // Создаем новый буфер с перекрытием
    const newBuffer = this.createOverlappingBuffer(finalizingBuffer);
    
    // Финализируем старый буфер
    this.finalizeBuffer(finalizingBuffer);
    
    // Устанавливаем новый как текущий
    this.currentBuffer = newBuffer;
    this.buffers.set(newBuffer.id, newBuffer);

    console.log('🔄 Buffer segmented:', {
      finalized: finalizingBuffer.id,
      new: newBuffer.id,
      overlap: `${this.config.overlapSize}s`
    });
  }

  /**
   * Создает новый буфер с перекрытием
   */
  private createOverlappingBuffer(previousBuffer: SmartBuffer): SmartBuffer {
    const overlapSamples = this.config.overlapSize * this.sampleRate;
    const previousSamples = previousBuffer.audioData.length;
    
    // Берем последние N секунд из предыдущего буфера
    const overlapStart = Math.max(0, previousSamples - overlapSamples);
    const overlapData = previousBuffer.audioData.slice(overlapStart);
    
    const newBuffer: SmartBuffer = {
      id: this.generateBufferId(),
      audioData: new Float32Array(overlapData),
      startTime: previousBuffer.endTime - this.config.overlapSize,
      endTime: previousBuffer.endTime,
      duration: this.config.overlapSize,
      overlapWith: [previousBuffer.id],
      isProcessed: false
    };

    // Обновляем информацию о перекрытии
    previousBuffer.overlapWith.push(newBuffer.id);

    return newBuffer;
  }

  /**
   * Создает новый буфер
   */
  private createNewBuffer(): SmartBuffer {
    const buffer: SmartBuffer = {
      id: this.generateBufferId(),
      audioData: new Float32Array(0),
      startTime: this.getCurrentTime(),
      endTime: this.getCurrentTime(),
      duration: 0,
      overlapWith: [],
      isProcessed: false
    };

    this.currentBuffer = buffer;
    this.buffers.set(buffer.id, buffer);
    
    return buffer;
  }

  /**
   * Финализирует буфер для обработки
   */
  private finalizeBuffer(buffer: SmartBuffer): void {
    buffer.isProcessed = true;
    
    // Добавляем pre/post speech буферы если нужно
    this.addSpeechBuffers(buffer);
    
    // Уведомляем о готовности буфера
    this.onBufferReady(buffer);
  }

  /**
   * Добавляет буферы до и после речи
   */
  private addSpeechBuffers(buffer: SmartBuffer): void {
    // В реальной реализации здесь будет анализ VAD данных
    // и добавление pre/post speech буферов
  }

  /**
   * Получает готовые для обработки буферы
   */
  getReadyBuffers(): SmartBuffer[] {
    return Array.from(this.buffers.values()).filter(buffer => 
      buffer.isProcessed && !buffer.transcription
    );
  }

  /**
   * Получает перекрытия между буферами
   */
  getBufferOverlaps(): BufferOverlap[] {
    const overlaps: BufferOverlap[] = [];
    
    for (const buffer of this.buffers.values()) {
      for (const overlapId of buffer.overlapWith) {
        const overlapBuffer = this.buffers.get(overlapId);
        if (overlapBuffer) {
          overlaps.push(this.calculateOverlap(buffer, overlapBuffer));
        }
      }
    }
    
    return overlaps;
  }

  /**
   * Вычисляет детали перекрытия между буферами
   */
  private calculateOverlap(buffer1: SmartBuffer, buffer2: SmartBuffer): BufferOverlap {
    const overlapStart = Math.max(buffer1.startTime, buffer2.startTime);
    const overlapEnd = Math.min(buffer1.endTime, buffer2.endTime);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    return {
      buffer1Id: buffer1.id,
      buffer2Id: buffer2.id,
      overlapStart,
      overlapEnd,
      overlapDuration,
      wordMatches: [] // Будет заполнено после транскрипции
    };
  }

  /**
   * Обновляет статистику скорости речи
   */
  updateSpeechRate(wordsPerMinute: number): void {
    this.averageSpeechRate = (this.averageSpeechRate * 0.8) + (wordsPerMinute * 0.2);
    console.log('📊 Speech rate updated:', this.averageSpeechRate, 'wpm');
  }

  /**
   * Callback при готовности буфера
   */
  private onBufferReady(buffer: SmartBuffer): void {
    // Этот метод будет переопределен для интеграции с транскрипцией
    console.log('✅ Buffer ready for transcription:', buffer.id);
  }

  // Утилиты
  private generateBufferId(): string {
    return `buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentTime(): number {
    return Date.now() / 1000;
  }

  // Геттеры для мониторинга
  get activeBuffers(): number {
    return this.buffers.size;
  }

  get currentBufferDuration(): number {
    return this.currentBuffer?.duration || 0;
  }

  get totalProcessedTime(): number {
    return Array.from(this.buffers.values())
      .filter(b => b.isProcessed)
      .reduce((sum, b) => sum + b.duration, 0);
  }
}
