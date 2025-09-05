import { useState, useRef, useCallback } from 'react';
import { TranscriptEvent } from '../services/deepgram';
import { ITranscriptionService } from '../types/ITranscriptionService';
import { TranscriptionServiceFactory } from '../services/transcription/TranscriptionServiceFactory';
import { createClaudeService, ClaudeAnalysisService, AnalysisContext, InsightResponse } from '../services/claude';
import { configService } from '../services/config';
import { LegacyInsight } from '../types/events';
import { PostEditorConfig, CorrectionContext } from '../services/post-editor';
import { useAudioAnalyser } from './useAudioAnalyser';

export interface UseTranscriptionReturn {
  // Состояния
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  isRecording: boolean;
  audioLevel: number;
  
  // Методы
  setTranscript: (transcript: string) => void;
  setPartialTranscript: (partialTranscript: string) => void;
  setInsights: (insights: LegacyInsight[]) => void;
  setIsRecording: (isRecording: boolean) => void;
  
  // Основные функции
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  connectToDeepgram: () => Promise<() => void>;
  analyzeWithClaude: (newText: string) => Promise<void>;
}

export const useTranscription = (): UseTranscriptionReturn => {
  // Состояния транскрипции
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [insights, setInsights] = useState<LegacyInsight[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  
  // Refs для сервисов
  const streamRef = useRef<MediaStream | null>(null);
  const deepgramRef = useRef<ITranscriptionService | null>(null);
  const claudeRef = useRef<ClaudeAnalysisService | null>(null);
  const analysisContextRef = useRef<AnalysisContext | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  
  // Audio analyser hook
  const { audioLevel, initAudioAnalyser, stopAudioAnalyser } = useAudioAnalyser();

  // Подключение к Deepgram
  const connectToDeepgram = useCallback(async (): Promise<() => void> => {
    console.log('🔗 [useTranscription] [DEEPGRAM] Starting Deepgram connection...');
    
    // Загружаем конфигурацию с переменными окружения из electronAPI
    await configService.getConfigWithEnv();
    
    // Логируем конфигурацию в dev режиме
    if (configService.isDevelopment) {
      console.log('🔧 [DEEPGRAM] Development mode - logging config...');
      configService.logConfig();
    }
    
    // Проверяем доступность Deepgram
    if (!configService.isDeepgramConfigured()) {
      throw new Error('❌ [DEEPGRAM] API key not configured! Please add DEEPGRAM_API_KEY to .env file');
    }
    
    console.log('✅ [DEEPGRAM] API key configured, proceeding with real connection...');

    // Инициализируем Claude сервис если доступен
    if (configService.isClaudeConfigured()) {
      try {
        const claudeConfig = configService.getClaudeConfig();
        claudeRef.current = createClaudeService(claudeConfig);
        analysisContextRef.current = new AnalysisContext();
        console.log('✅ Claude service initialized:', {
          model: claudeConfig.model,
          maxTokens: claudeConfig.maxTokens,
          temperature: claudeConfig.temperature
        });
      } catch (error) {
        console.warn('⚠️ Claude service failed to initialize:', error);
      }
    } else {
      console.log('⚠️ Claude API key not configured, insights will be limited...');
    }

    try {
      console.log('📡 [DEEPGRAM] Connecting to real Deepgram...');
      
      const deepgramConfig = configService.getDeepgramConfig();
      console.log('🔧 [DEEPGRAM] Using config:', {
        model: deepgramConfig.model,
        language: deepgramConfig.language,
        interim_results: deepgramConfig.interim_results,
        endpointing: deepgramConfig.endpointing
      });
      
      // Подготавливаем конфигурацию постредактора
      let postEditorConfig: PostEditorConfig | undefined;
      let correctionContext: CorrectionContext | undefined;
      
      if (configService.isPostEditorConfigured()) {
        postEditorConfig = configService.getPostEditorConfig();
        correctionContext = {
          jobTerms: [],
          synonymDictionary: {}
        };
        console.log('🔧 Post-editor enabled:', {
          model: postEditorConfig.model,
          timeout: postEditorConfig.timeoutMs
        });
      } else {
        console.log('⚠️ Post-editor not configured, skipping...');
      }
      
      // Создаем транскрипционный сервис через фабрику
      const deepgram = TranscriptionServiceFactory.create({
        provider: 'deepgram',
        apiKey: deepgramConfig.apiKey,
        onTranscript: async (event: TranscriptEvent) => {
          console.log('📝 [TRANSCRIPT] Received Deepgram event:', {
            type: event.type,
            text: event.text?.substring(0, 50) + '...',
            confidence: event.confidence,
            timestamp: new Date().toLocaleTimeString()
          });
          
          if (event.type === 'partial') {
            const newPartial = event.text;
            setPartialTranscript(newPartial);
            console.log('🔄 [PARTIAL] Deepgram partial:', newPartial);
          } else if (event.type === 'final') {
            // Обновляем отображаемый транскрипт
            const newTranscript = (transcript + ' ' + event.text).trim();
            setTranscript(newTranscript);
            setPartialTranscript('');
            
            console.log('✅ [FINAL] Deepgram final result:', {
              text: event.text,
              confidence: event.confidence,
              length: event.text.length,
              wordCount: event.text.split(' ').length
            });
            
            // Анализируем с помощью Claude если доступен
            if (event.text.length > 10) {
              await analyzeWithClaude(event.text);
            }
          }
        },
        onError: (error: string) => {
          console.error('❌ [DEEPGRAM] Error:', error);
          setInsights(prev => [...prev.slice(-2), {
            id: Date.now().toString(),
            text: `Deepgram API error: ${error}`,
            type: 'risk'
          }]);
        },
        deepgramConfig,
        postEditorConfig,
        correctionContext
      });

      deepgramRef.current = deepgram;
      await deepgram.connect();
      
      return () => {
        deepgram.disconnect();
        deepgramRef.current = null;
        claudeRef.current = null;
        analysisContextRef.current = null;
      };
      
    } catch (error) {
      console.error('❌ [DEEPGRAM] Failed to connect to Deepgram:', error);
      throw error;
    }
  }, [transcript]);

  // Анализ транскрипта с помощью Claude AI
  const analyzeWithClaude = useCallback(async (newText: string): Promise<void> => {
    if (!claudeRef.current || !analysisContextRef.current) {
      console.log('⚠️ Claude not available, skipping analysis...');
      return;
    }

    try {
      // Добавляем новый текст в контекст
      analysisContextRef.current.addTranscript(newText);
      const context = analysisContextRef.current.getContext();

      // Создаем запрос для анализа
      const analysisRequest = {
        transcript: newText,
        contextWindow: context.contextWindow,
        entities: context.entities,
        topicHistory: context.topicHistory
      };

      console.log('🤖 Analyzing with Claude...', {
        text_length: newText.length,
        context_words: context.contextWindow.length,
        entities: context.entities.length
      });

      // Получаем анализ от Claude
      const analysis: InsightResponse = await claudeRef.current.analyzeTranscript(analysisRequest);

      // Добавляем топик в историю
      analysisContextRef.current.addTopic(analysis.topic);

      // Конвертируем в формат legacy insight для UI
      const legacyInsight: LegacyInsight = {
        id: Date.now().toString(),
        text: analysis.note,
        type: analysis.type
      };

      // Обновляем UI (показываем последние 3 insights)
      setInsights(prev => [...prev.slice(-2), legacyInsight]);

      console.log('✅ Claude analysis complete:', {
        topic: analysis.topic,
        depth_score: analysis.depth_score,
        type: analysis.type,
        note_length: analysis.note.length
      });

    } catch (error) {
      console.error('❌ Claude analysis failed:', error);
      setInsights(prev => [...prev.slice(-2), {
        id: Date.now().toString(),
        text: `Claude analysis error: ${error}`,
        type: 'risk'
      }]);
    }
  }, []);

  // Начало записи
  const startRecording = useCallback(async () => {
    try {
      console.log('🎬 [useTranscription] [STEP 1] Starting recording...');
      
      // СНАЧАЛА меняем состояние UI для мгновенной реакции
      setIsRecording(true);
      console.log('✅ [useTranscription] [STEP 2] UI state updated to recording');
      
      // Остальные операции выполняем в фоне
      setTimeout(async () => {
        try {
          console.log('🎤 [STEP 3] Getting microphone access...');
          const audioConstraints = configService.getAudioConstraints();
          const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          streamRef.current = stream;
          console.log('✅ [STEP 4] Microphone access granted');

          console.log('🎵 [STEP 4.5] Initializing audio analyser...');
          initAudioAnalyser(stream);
          console.log('✅ [STEP 4.5] Audio analyser initialized');

          console.log('🔗 [STEP 5] Connecting to Deepgram...');
          const cleanup = await connectToDeepgram();
          cleanupRef.current = cleanup;
          console.log('✅ [STEP 6] Deepgram connected successfully');

          console.log('🎵 [STEP 7] Setting up audio pipeline...');
          
          // ПРОСТОЙ АУДИО PIPELINE с AudioWorklet
          try {
            const audioContext = new AudioContext({ sampleRate: 16000 });
            await audioContext.audioWorklet.addModule('/audioWorklet.js');
            
            const source = audioContext.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
            
            // Сохраняем ссылки для cleanup
            audioContextRef.current = audioContext;
            processorRef.current = workletNode as any;
            
            // Обработчик аудио данных от worklet
            workletNode.port.onmessage = (event) => {
              if (deepgramRef.current && event.data && event.data.type === 'pcm-data') {
                deepgramRef.current.sendAudio(event.data.data);
                console.log('📡 [AUDIO] Sent', event.data.data.byteLength, 'bytes to Deepgram (AudioWorklet)');
              }
            };
            
            source.connect(workletNode);
            console.log('✅ [STEP 8] AudioWorklet pipeline connected!');
            
          } catch (error) {
            console.warn('⚠️ AudioWorklet failed, falling back to ScriptProcessor:', error);
            
            // Fallback к ScriptProcessor
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            audioContextRef.current = audioContext;
            processorRef.current = processor;
            
            processor.onaudioprocess = (event) => {
              if (deepgramRef.current) {
                const inputData = event.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                deepgramRef.current.sendAudio(pcm16.buffer);
                console.log('📡 [AUDIO] Sent', pcm16.length, 'samples to Deepgram (ScriptProcessor)');
              }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            console.log('✅ [STEP 8] ScriptProcessor pipeline connected!');
          }

          console.log('🎯 [STEP 7] Recording started successfully!');
        } catch (error) {
          console.error('❌ [ERROR] Failed to start recording:', error);
          setIsRecording(false);
          setInsights(prev => [...prev.slice(-2), {
            id: Date.now().toString(),
            text: `Recording failed: ${error}`,
            type: 'risk'
          }]);
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ [ERROR] Start recording failed:', error);
      setIsRecording(false);
    }
  }, [connectToDeepgram, initAudioAnalyser]);

  // Остановка записи
  const stopRecording = useCallback(() => {
    console.log('🛑 [STOP] Stopping recording...');
    
    // Останавливаем аудио pipeline
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
      console.log('🔌 [STOP] Audio processor disconnected');
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('🔌 [STOP] Audio context closed');
    }
    
    // Останавливаем медиа поток
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      console.log('🔌 [STOP] Media stream stopped');
    }
    
    // Отключаем Deepgram
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
      console.log('🔌 [STOP] Deepgram disconnected');
    }
    
    // Останавливаем аудио анализатор
    stopAudioAnalyser();
    console.log('🔌 [STOP] Audio analyser stopped');
    
    setIsRecording(false);
    console.log('✅ [STOP] Recording stopped successfully');
  }, [stopAudioAnalyser]);

  return {
    // Состояния
    transcript,
    partialTranscript,
    insights,
    isRecording,
    audioLevel,
    
    // Методы
    setTranscript,
    setPartialTranscript,
    setInsights,
    setIsRecording,
    
    // Основные функции
    startRecording,
    stopRecording,
    connectToDeepgram,
    analyzeWithClaude
  };
};
