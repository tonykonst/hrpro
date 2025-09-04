import { OpenAIWhisperService } from './OpenAIWhisperService';
import { SmartBufferManager } from './buffering/SmartBufferManager';
import { EnhancedVAD } from './buffering/EnhancedVAD';
import { configService } from '../config';

/**
 * НАСТОЯЩИЙ сервис замены Deepgram на OpenAI Whisper API
 * БЕЗ СИМУЛЯЦИЙ! Только реальные API вызовы
 */
export class RealWhisperReplacementService {
  private whisperApi: OpenAIWhisperService;
  private bufferManager: SmartBufferManager | null = null;
  private vadService: EnhancedVAD | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  
  // Состояние
  private isActive = false;
  private isInitialized = false;
  
  // Callbacks (совместимость с DeepgramService)
  private onTranscriptCallback?: (event: TranscriptEvent) => void;
  private onErrorCallback?: (error: string) => void;
  
  // Обработка аудио
  private processingInterval: NodeJS.Timeout | null = null;
  private bufferCheckInterval: NodeJS.Timeout | null = null;
  
  // Контекст для улучшения качества
  private transcriptHistory: string[] = [];

  constructor() {
    // Проверяем конфигурацию OpenAI
    if (!configService.isOpenAIConfigured()) {
      throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to .env file');
    }

    const openaiConfig = configService.getOpenAIConfig();
    this.whisperApi = new OpenAIWhisperService(openaiConfig.apiKey);
    
    console.log('🎯 RealWhisperReplacementService initialized (REAL OpenAI API)');
  }

  /**
   * Подключается к аудио потоку - РЕАЛЬНАЯ замена Deepgram
   */
  async connect(): Promise<() => void> {
    try {
      console.log('🔄 Connecting to REAL Whisper service...');
      
      // Получаем аудио поток
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false, // Для чистого тестирования
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

      // Инициализируем smart buffer manager
      this.bufferManager = new SmartBufferManager({
        baseWindowSize: 15, // Уменьшаем для быстрого тестирования
        overlapSize: 3,     // 3 секунды перекрытие
        adaptToSpeechRate: true,
        extendOnActiveSpeech: true,
        silenceThreshold: 0.8,  // Более агрессивная сегментация
        energyThreshold: 0.1,
        preSpeechBuffer: 0.5,
        postSpeechBuffer: 1.0
      }, audioContext);

      // Настраиваем аудио обработку
      await this.setupAudioProcessing(stream, audioContext);

      // Запускаем мониторинг буферов
      this.startBufferMonitoring();

      this.isActive = true;
      console.log('✅ REAL Whisper service connected and active');

      // Возвращаем функцию очистки (совместимость с Deepgram API)
      return () => this.disconnect();

    } catch (error) {
      console.error('❌ Failed to connect REAL Whisper service:', error);
      throw error;
    }
  }

  /**
   * Настраивает обработку аудио потока
   */
  private async setupAudioProcessing(stream: MediaStream, audioContext: AudioContext): Promise<void> {
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    // Обрабатываем аудио каждые 100ms
    const processAudio = () => {
      if (!this.isActive || !this.vadService || !this.bufferManager) return;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Конвертируем в Float32Array для VAD
      const audioData = new Float32Array(dataArray.length);
      for (let i = 0; i < dataArray.length; i++) {
        audioData[i] = (dataArray[i] - 128) / 128.0;
      }
      
      // Анализируем с VAD
      const vadResult = this.vadService.analyze(audioData);
      
      // Добавляем в smart buffer
      this.bufferManager.addAudioChunk(audioData, vadResult);
    };
    
    this.processingInterval = setInterval(processAudio, 100);
  }

  /**
   * Мониторинг готовых буферов для отправки в НАСТОЯЩИЙ Whisper API
   */
  private startBufferMonitoring(): void {
    const checkBuffers = async () => {
      if (!this.bufferManager || !this.isActive) return;

      const readyBuffers = this.bufferManager.getReadyBuffers();
      const unprocessedBuffers = readyBuffers.filter(buffer => !buffer.transcription);

      for (const buffer of unprocessedBuffers) {
        try {
          await this.processBufferWithRealWhisper(buffer);
        } catch (error) {
          console.error(`❌ Failed to process buffer ${buffer.id} with REAL Whisper:`, error);
          
          // Уведомляем об ошибке
          if (this.onErrorCallback) {
            this.onErrorCallback(`Whisper processing error: ${error}`);
          }
        }
      }
    };

    // Проверяем буферы каждые 2 секунды
    this.bufferCheckInterval = setInterval(checkBuffers, 2000);
  }

  /**
   * Обрабатывает буфер с НАСТОЯЩИМ OpenAI Whisper API
   */
  private async processBufferWithRealWhisper(buffer: any): Promise<void> {
    console.log(`🔄 Processing buffer ${buffer.id} with REAL OpenAI Whisper API (${buffer.duration.toFixed(1)}s)`);
    
    try {
      // Конвертируем аудио данные в WAV Blob
      const audioBlob = this.audioDataToWAV(buffer.audioData);
      
      // Строим контекстный промпт
      const contextPrompt = this.buildContextPrompt();
      
      // РЕАЛЬНЫЙ вызов к OpenAI Whisper API
      const result = await this.whisperApi.transcribe(audioBlob, {
        language: null, // Автодетекция RU/EN
        prompt: contextPrompt,
        temperature: 0.0,
        response_format: 'verbose_json'
      });

      // Сохраняем результат в буфер
      buffer.transcription = {
        text: result.text,
        confidence: result.confidence,
        wordTimestamps: result.words || [],
        language: result.language,
        isDraft: false,
        processingTime: 0 // Будет вычислено
      };
      
      // Обновляем историю для контекста
      this.updateTranscriptHistory(result.text);
      
      // Уведомляем о новом тексте (совместимость с Deepgram API)
      if (this.onTranscriptCallback && result.text.trim()) {
        this.onTranscriptCallback({
          type: 'final',
          text: result.text,
          confidence: result.confidence,
          timestamp: Date.now(),
          language: result.language
        });
      }
      
      console.log(`✅ REAL Whisper result: "${result.text.substring(0, 50)}..." (${(result.confidence * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ REAL Whisper API error for buffer ${buffer.id}:`, error);
      throw error;
    }
  }

  /**
   * Конвертирует Float32Array в WAV Blob
   */
  private audioDataToWAV(audioData: Float32Array): Blob {
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
   * Строит контекстный промпт из истории
   */
  private buildContextPrompt(): string {
    const openaiConfig = configService.getOpenAIConfig();
    let prompt = openaiConfig.prompt;
    
    if (this.transcriptHistory.length > 0) {
      const recentContext = this.transcriptHistory.slice(-2).join(' ');
      prompt += ` Previous context: "${recentContext}"`;
    }
    
    return prompt;
  }

  /**
   * Обновляет историю транскрипции для контекста
   */
  private updateTranscriptHistory(newText: string): void {
    if (newText.trim().length > 0) {
      this.transcriptHistory.push(newText.trim());
      
      // Ограничиваем историю
      if (this.transcriptHistory.length > 5) {
        this.transcriptHistory.shift();
      }
    }
  }

  /**
   * Устанавливает callbacks (совместимость с Deepgram API)
   */
  setCallbacks(
    onTranscript: (event: TranscriptEvent) => void,
    onError: (error: string) => void
  ): void {
    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
  }

  /**
   * Отключается от аудио потока
   */
  async disconnect(): Promise<void> {
    console.log('🔄 Disconnecting REAL Whisper service...');
    
    this.isActive = false;
    
    // Останавливаем интервалы
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.bufferCheckInterval) {
      clearInterval(this.bufferCheckInterval);
      this.bufferCheckInterval = null;
    }
    
    // Останавливаем буферизацию
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
    
    console.log('✅ REAL Whisper service disconnected');
  }

  /**
   * Получить статистику (совместимость с Deepgram API)
   */
  getStats() {
    return {
      isActive: this.isActive,
      isInitialized: this.isInitialized,
      transcriptHistory: this.transcriptHistory.length,
      buffers: this.bufferManager ? {
        active: this.bufferManager.activeBuffers,
        currentDuration: this.bufferManager.currentBufferDuration,
        totalProcessed: this.bufferManager.totalProcessedTime
      } : null,
      vad: this.vadService ? this.vadService.getStats() : null
    };
  }
}

// Интерфейс для совместимости с существующим кодом
export interface TranscriptEvent {
  type: 'partial' | 'final';
  text: string;
  confidence: number;
  timestamp: number;
  language?: string;
}

/**
 * Фабрика для создания НАСТОЯЩЕГО Whisper сервиса
 * Заменяет createDeepgramService
 */
export const createRealWhisperService = (
  onTranscript: (event: TranscriptEvent) => void,
  onError: (error: string) => void
) => {
  const service = new RealWhisperReplacementService();
  service.setCallbacks(onTranscript, onError);
  
  return {
    connect: () => service.connect(),
    disconnect: () => service.disconnect(),
    getStats: () => service.getStats()
  };
};
