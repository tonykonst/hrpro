import { RealWhisperService } from './transcription/RealWhisperService';
import { SmartBufferManager } from './buffering/SmartBufferManager';
import { EnhancedVAD } from './buffering/EnhancedVAD';
import { SmartBuffer, TranscriptionResult, VADResult } from '../../types/v041/buffering';

/**
 * Основной сервис транскрипции v0.41
 * Заменяет DeepgramService с нулевой потерей слов
 */
export class WhisperTranscriptionServiceV041 {
  private whisperService: RealWhisperService;
  private bufferManager: SmartBufferManager | null = null;
  private vadService: EnhancedVAD | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  
  // Состояние
  private isActive = false;
  private isInitialized = false;
  
  // Callbacks
  private onTranscriptCallback?: (text: string, isPartial: boolean, confidence: number) => void;
  private onErrorCallback?: (error: string) => void;
  
  // Буферизация аудио для обработки
  private audioProcessor: ScriptProcessorNode | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  
  // Статистика сессии
  private sessionStats = {
    startTime: 0,
    totalSegments: 0,
    averageConfidence: 0,
    wordCount: 0,
    languageDistribution: new Map<string, number>()
  };

  constructor() {
    this.whisperService = new RealWhisperService();
    console.log('🎯 WhisperTranscriptionServiceV041 created');
  }

  /**
   * Инициализация сервиса
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing Whisper v0.41 service...');
      
      // Инициализируем Whisper
      await this.whisperService.initialize();
      
      this.isInitialized = true;
      console.log('✅ Whisper v0.41 service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Whisper v0.41:', error);
      throw error;
    }
  }

  /**
   * Подключается к аудио потоку и начинает транскрипцию
   */
  async connect(
    onTranscript: (text: string, isPartial: boolean, confidence: number) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    try {
      // Получаем аудио поток
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false, // Отключаем для чистого тестирования
          autoGainControl: false
        }
      });

      this.stream = stream;

      // Создаем аудио контекст
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      this.audioContext = audioContext;

      // Инициализируем VAD
      this.vadService = new EnhancedVAD(audioContext, stream);

      // Инициализируем менеджер буферов
      this.bufferManager = new SmartBufferManager({
        baseWindowSize: 30,
        overlapSize: 8,
        adaptToSpeechRate: true,
        extendOnActiveSpeech: true,
        silenceThreshold: 0.5,
        energyThreshold: 0.1,
        preSpeechBuffer: 0.5,
        postSpeechBuffer: 1.0
      }, audioContext);

      // Настраиваем аудио обработку
      await this.setupAudioProcessing(stream, audioContext);

      // Запускаем мониторинг буферов
      this.startBufferMonitoring();

      this.isActive = true;
      this.sessionStats.startTime = Date.now();
      
      console.log('✅ Whisper v0.41 connected and active');

    } catch (error) {
      console.error('❌ Failed to connect Whisper v0.41:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Connection failed: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Настраивает аудио обработку
   */
  private async setupAudioProcessing(stream: MediaStream, audioContext: AudioContext): Promise<void> {
    const source = audioContext.createMediaStreamSource(stream);
    
    // Используем AnalyserNode для совместимости
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    // Обрабатываем аудио через интервал
    const processAudio = () => {
      if (!this.isActive || !this.vadService || !this.bufferManager) return;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Конвертируем в Float32Array
      const audioData = new Float32Array(dataArray.length);
      for (let i = 0; i < dataArray.length; i++) {
        audioData[i] = (dataArray[i] - 128) / 128.0;
      }
      
      // Анализируем с VAD
      const vadResult = this.vadService.analyze(audioData);
      
      // Добавляем в буфер
      this.bufferManager.addAudioChunk(audioData, vadResult);
    };
    
    this.processingInterval = setInterval(processAudio, 100); // 10 раз в секунду
  }

  /**
   * Мониторинг готовых буферов
   */
  private startBufferMonitoring(): void {
    const checkBuffers = async () => {
      if (!this.bufferManager || !this.isActive) return;

      const readyBuffers = this.bufferManager.getReadyBuffers();
      const unprocessedBuffers = readyBuffers.filter(buffer => !buffer.transcription);

      for (const buffer of unprocessedBuffers) {
        try {
          await this.processBuffer(buffer);
        } catch (error) {
          console.error(`❌ Failed to process buffer ${buffer.id}:`, error);
        }
      }
    };

    // Проверяем буферы каждые 2 секунды
    setInterval(checkBuffers, 2000);
  }

  /**
   * Обрабатывает готовый буфер
   */
  private async processBuffer(buffer: SmartBuffer): Promise<void> {
    try {
      console.log(`🔄 Processing buffer ${buffer.id} (${buffer.duration.toFixed(1)}s)`);
      
      // Конвертируем аудио данные в Blob
      const audioBlob = this.audioDataToBlob(buffer.audioData);
      
      // Транскрибируем с Whisper
      const result = await this.whisperService.transcribe(audioBlob);
      
      // Сохраняем результат в буфер
      buffer.transcription = result;
      buffer.confidence = result.confidence;
      
      // Обновляем статистику сессии
      this.updateSessionStats(result);
      
      // Уведомляем о новом тексте
      if (this.onTranscriptCallback && result.text.trim()) {
        this.onTranscriptCallback(result.text, false, result.confidence);
      }
      
      console.log(`✅ Buffer processed: "${result.text.substring(0, 50)}..." (${(result.confidence * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Buffer processing error:`, error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Processing error: ${error}`);
      }
    }
  }

  /**
   * Конвертирует Float32Array в WAV Blob
   */
  private audioDataToBlob(audioData: Float32Array): Blob {
    // Простая конверсия в WAV формат
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);
    
    // WAV заголовок
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
    view.setUint16(32, numChannels * bitsPerSample / 8, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, audioData.length * 2, true);
    
    // Аудио данные
    let offset = 44;
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Обновляет статистику сессии
   */
  private updateSessionStats(result: TranscriptionResult): void {
    this.sessionStats.totalSegments++;
    this.sessionStats.wordCount += result.wordTimestamps.length;
    
    // Средняя уверенность
    this.sessionStats.averageConfidence = (
      (this.sessionStats.averageConfidence * (this.sessionStats.totalSegments - 1) + result.confidence) /
      this.sessionStats.totalSegments
    );
    
    // Распределение языков
    const currentCount = this.sessionStats.languageDistribution.get(result.language) || 0;
    this.sessionStats.languageDistribution.set(result.language, currentCount + 1);
  }

  /**
   * Отключается от аудио потока
   */
  async disconnect(): Promise<void> {
    console.log('🔄 Disconnecting Whisper v0.41...');
    
    this.isActive = false;
    
    // Останавливаем обработку аудио
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Останавливаем менеджер буферов
    if (this.bufferManager) {
      this.bufferManager.stopBuffering();
    }
    
    // Закрываем аудио поток
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Закрываем аудио контекст
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // Завершаем Whisper сервис
    await this.whisperService.shutdown();
    
    // Логируем статистику сессии
    this.logSessionStats();
    
    console.log('✅ Whisper v0.41 disconnected');
  }

  /**
   * Логирует статистику сессии
   */
  private logSessionStats(): void {
    const duration = (Date.now() - this.sessionStats.startTime) / 1000 / 60; // минуты
    
    console.log('📊 Session completed:', {
      duration_minutes: duration.toFixed(1),
      total_segments: this.sessionStats.totalSegments,
      word_count: this.sessionStats.wordCount,
      avg_confidence: this.sessionStats.averageConfidence.toFixed(3),
      languages: Object.fromEntries(this.sessionStats.languageDistribution)
    });
  }

  /**
   * Получить статистику сервиса
   */
  getStats() {
    return {
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      session: this.sessionStats,
      whisper: this.whisperService.getStats(),
      buffers: this.bufferManager ? {
        active: this.bufferManager.activeBuffers,
        currentDuration: this.bufferManager.currentBufferDuration,
        totalProcessed: this.bufferManager.totalProcessedTime
      } : null,
      vad: this.vadService ? this.vadService.getStats() : null
    };
  }
}
