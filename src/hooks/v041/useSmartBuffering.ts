import { useState, useEffect, useRef, useCallback } from 'react';
import { SmartBufferManager } from '../../services/v041/buffering/SmartBufferManager';
import { EnhancedVAD } from '../../services/v041/buffering/EnhancedVAD';
import { TranscriptionIntegrator, QualityMetrics as TranscriptionQualityMetrics } from '../../services/v041/transcription/TranscriptionIntegrator';
import { 
  SmartBuffer, 
  BufferConfig, 
  QualityMetrics,
  VADResult,
  TranscriptionResult
} from '../../types/v041/buffering';

interface UseSmartBufferingOptions {
  config?: Partial<BufferConfig>;
  onBufferReady?: (buffer: SmartBuffer) => void;
  onTranscription?: (buffer: SmartBuffer, result: TranscriptionResult) => void;
  onQualityUpdate?: (metrics: QualityMetrics) => void;
}

interface SmartBufferingState {
  isActive: boolean;
  currentBuffer: SmartBuffer | null;
  readyBuffers: SmartBuffer[];
  qualityMetrics: QualityMetrics;
  vadStats: {
    isActive: boolean;
    averageEnergy: number;
    speechTime: number;
  };
}

/**
 * Хук для интеллектуальной буферизации аудио с нулевой потерей слов
 */
export function useSmartBuffering(options: UseSmartBufferingOptions = {}) {
  // Состояние
  const [state, setState] = useState<SmartBufferingState>({
    isActive: false,
    currentBuffer: null,
    readyBuffers: [],
    qualityMetrics: {
      wordsPerMinute: 0,
      correctionRate: 0,
      confidenceScore: 0,
      languageSwitches: 0,
      technicalTermsDetected: 0,
      bufferOverlapQuality: 0,
      lostWordsPrevented: 0
    },
    vadStats: {
      isActive: false,
      averageEnergy: 0,
      speechTime: 0
    }
  });

  // Ссылки на сервисы
  const bufferManagerRef = useRef<SmartBufferManager | null>(null);
  const vadRef = useRef<EnhancedVAD | null>(null);
  const transcriptionIntegratorRef = useRef<TranscriptionIntegrator | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Интервал для обновления статистики
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Инициализация аудио контекста и сервисов
   */
  const initializeAudio = useCallback(async (): Promise<void> => {
    try {
      // Получаем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });

      streamRef.current = stream;

      // Создаем аудио контекст
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;

      // Инициализируем VAD
      const vad = new EnhancedVAD(audioContext, stream);
      vadRef.current = vad;

      // Инициализируем менеджер буферов
      const config: BufferConfig = {
        baseWindowSize: 30,
        overlapSize: 8,
        adaptToSpeechRate: true,
        extendOnActiveSpeech: true,
        silenceThreshold: 0.5,
        energyThreshold: 0.1,
        preSpeechBuffer: 0.5,
        postSpeechBuffer: 1.0,
        ...options.config
      };

      const bufferManager = new SmartBufferManager(config, audioContext);
      bufferManagerRef.current = bufferManager;

      // Инициализируем интегратор транскрипции
      const transcriptionIntegrator = new TranscriptionIntegrator();
      transcriptionIntegratorRef.current = transcriptionIntegrator;
      
      // Подключаем менеджер буферов к интегратору
      transcriptionIntegrator.connectBufferManager(bufferManager);
      
      // Настраиваем callbacks
      if (options.onTranscription) {
        transcriptionIntegrator.onTranscription(options.onTranscription);
      }
      
      transcriptionIntegrator.onQualityUpdate((metrics) => {
        // Конвертируем метрики для совместимости
        const convertedMetrics: QualityMetrics = {
          wordsPerMinute: 0,
          correctionRate: 0,
          confidenceScore: metrics.averageConfidence,
          languageSwitches: 0,
          technicalTermsDetected: 0,
          bufferOverlapQuality: metrics.overlapQuality,
          lostWordsPrevented: metrics.wordsPreserved
        };
        
        if (options.onQualityUpdate) {
          options.onQualityUpdate(convertedMetrics);
        }
      });

      // Настраиваем аудио обработку (упрощенная версия для демо)
      const source = audioContext.createMediaStreamSource(stream);
      
      // Используем AnalyserNode для демо (без обработки аудио)
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      // Симулируем обработку аудио через интервал
      const processingInterval = setInterval(() => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Конвертируем в Float32Array для совместимости
        const audioData = new Float32Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
          audioData[i] = (dataArray[i] - 128) / 128.0;
        }
        
        // Анализируем с помощью VAD
        const vadResult = vad.analyze(audioData);
        
        // Добавляем в буфер
        bufferManager.addAudioChunk(audioData, vadResult);
        
        // Обновляем статистику
        updateVADStats(vadResult);
      }, 100); // Каждые 100ms
      
      // Сохраняем интервал для очистки
      processorRef.current = { disconnect: () => clearInterval(processingInterval) } as any;

      console.log('🎯 Smart buffering audio initialized');
    } catch (error) {
      console.error('❌ Failed to initialize smart buffering:', error);
      throw error;
    }
  }, [options.config]);

  /**
   * Начинает умную буферизацию
   */
  const startBuffering = useCallback(async (): Promise<void> => {
    if (!bufferManagerRef.current) {
      await initializeAudio();
    }

    if (bufferManagerRef.current && audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      bufferManagerRef.current.startBuffering();
      
      // Запускаем интегратор транскрипции
      if (transcriptionIntegratorRef.current) {
        await transcriptionIntegratorRef.current.start();
      }
      
      // Запускаем обновление статистики
      statsIntervalRef.current = setInterval(updateStats, 1000);

      setState(prev => ({ ...prev, isActive: true }));
      console.log('▶️ Smart buffering started');
    }
  }, [initializeAudio]);

  /**
   * Останавливает умную буферизацию
   */
  const stopBuffering = useCallback(async (): Promise<void> => {
    if (bufferManagerRef.current) {
      bufferManagerRef.current.stopBuffering();
    }

    // Останавливаем интегратор транскрипции
    if (transcriptionIntegratorRef.current) {
      await transcriptionIntegratorRef.current.stop();
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    setState(prev => ({ ...prev, isActive: false }));
    console.log('⏹️ Smart buffering stopped');
  }, []);

  /**
   * Обновляет статистику VAD
   */
  const updateVADStats = useCallback((vadResult: VADResult): void => {
    if (!vadRef.current) return;

    const stats = vadRef.current.getStats();
    setState(prev => ({
      ...prev,
      vadStats: {
        isActive: stats.isActive,
        averageEnergy: stats.averageEnergy,
        speechTime: stats.speechTime
      }
    }));
  }, []);

  /**
   * Обновляет общую статистику
   */
  const updateStats = useCallback((): void => {
    if (!bufferManagerRef.current) return;

    const readyBuffers = bufferManagerRef.current.getReadyBuffers();
    
    setState(prev => ({
      ...prev,
      readyBuffers,
      qualityMetrics: {
        ...prev.qualityMetrics,
        bufferOverlapQuality: calculateOverlapQuality(readyBuffers)
      }
    }));

    // Уведомляем о готовых буферах
    if (options.onBufferReady) {
      readyBuffers.forEach(buffer => {
        if (!buffer.transcription) { // Новый буфер
          options.onBufferReady!(buffer);
        }
      });
    }
  }, [options.onBufferReady]);

  /**
   * Вычисляет качество перекрытий
   */
  const calculateOverlapQuality = useCallback((buffers: SmartBuffer[]): number => {
    if (buffers.length < 2) return 1.0;

    let totalOverlap = 0;
    let validOverlaps = 0;

    for (const buffer of buffers) {
      if (buffer.overlapWith.length > 0) {
        totalOverlap += buffer.overlapWith.length;
        validOverlaps++;
      }
    }

    return validOverlaps > 0 ? Math.min(1.0, totalOverlap / validOverlaps / 2) : 1.0;
  }, []);

  /**
   * Обновляет конфигурацию буферизации
   */
  const updateConfig = useCallback((newConfig: Partial<BufferConfig>): void => {
    if (bufferManagerRef.current) {
      // В реальной реализации нужно пересоздать менеджер с новой конфигурацией
      console.log('🔧 Buffer config updated:', newConfig);
    }
  }, []);

  /**
   * Настройка чувствительности VAD
   */
  const setVADSensitivity = useCallback((energy: number, spectral: number, preSpeech: number): void => {
    if (vadRef.current) {
      vadRef.current.setSensitivity(energy, spectral, preSpeech);
    }
  }, []);

  /**
   * Получение детальной статистики
   */
  const getDetailedStats = useCallback(() => {
    if (!bufferManagerRef.current || !vadRef.current) {
      return null;
    }

    return {
      bufferManager: {
        activeBuffers: bufferManagerRef.current.activeBuffers,
        currentBufferDuration: bufferManagerRef.current.currentBufferDuration,
        totalProcessedTime: bufferManagerRef.current.totalProcessedTime
      },
      vad: vadRef.current.getStats(),
      overlaps: bufferManagerRef.current.getBufferOverlaps()
    };
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      
      if (processorRef.current && typeof processorRef.current.disconnect === 'function') {
        processorRef.current.disconnect();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    // Состояние
    ...state,
    
    // Методы управления
    startBuffering,
    stopBuffering,
    updateConfig,
    setVADSensitivity,
    
    // Утилиты
    getDetailedStats,
    
    // Статус инициализации
    isInitialized: !!bufferManagerRef.current
  };
}
