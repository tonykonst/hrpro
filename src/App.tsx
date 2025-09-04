import React, { useState, useEffect, useRef } from "react";
import { createDeepgramService, DeepgramService, TranscriptEvent } from "./services/deepgram";
import { createClaudeService, ClaudeAnalysisService, AnalysisContext, InsightResponse, ClaudeServiceConfig } from "./services/claude";
import { configService } from "./services/config";
import { LegacyInsight } from "./types/events";
import { StartScreen, RecordingScreen, WaveLoader } from "./components";
import { useAudioAnalyser } from "./hooks/useAudioAnalyser";
import { PostEditorConfig, CorrectionContext } from "./services/post-editor";
import { endCurrentSession } from "./services/transcript-logger";

// Типы для IPC
declare global {
  interface Window {
    require: any;
  }
}

export function App() {
  // Определяем тип окна из URL параметров
  const urlParams = new URLSearchParams(window.location.search);
  const windowType = urlParams.get('window') || 'control'; // 'control' или 'data'
  


  const [isVisible, setIsVisible] = useState(true);
  const [clickThrough, setClickThrough] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [insights, setInsights] = useState<Array<LegacyInsight>>([]);
  const [fullTranscript, setFullTranscript] = useState<string>(''); // Накапливаем полный текст
  const [showTranscript, setShowTranscript] = useState(false);
  const [correctedSegments, setCorrectedSegments] = useState<Map<string, string>>(new Map()); // segment_id -> corrected text
  const [lastCorrectionTime, setLastCorrectionTime] = useState<number>(0);
  // Removed background blur functionality
  
  // mediaRecorderRef удален - больше не нужен
  const streamRef = useRef<MediaStream | null>(null);
  const deepgramRef = useRef<DeepgramService | null>(null);
  const claudeRef = useRef<ClaudeAnalysisService | null>(null);
  const analysisContextRef = useRef<AnalysisContext | null>(null);
  // const ragServiceRef = useRef<RAGService | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Audio analysis hook
  const { audioLevel, initAudioAnalyser, stopAudioAnalyser } = useAudioAnalyser();

  // Функция для добавления тестовых документов
  const addSampleDocuments = async () => {
    // if (!ragServiceRef.current) {
      console.log('📝 RAG service disabled, skipping sample documents');
      return;
    // }

    // RAG system temporarily disabled
    console.log('✅ RAG system disabled - skipping document loading');
  };

  // Cleanup audio analyser when recording stops
  useEffect(() => {
    if (!isRecording) {
      stopAudioAnalyser();
    }
  }, [isRecording, stopAudioAnalyser]);

  useEffect(() => {
    console.log('🚀 App component mounted');
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        setIsVisible(!isVisible);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        setClickThrough(!clickThrough);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isVisible, clickThrough]);

  useEffect(() => {
    console.log('🎤 Checking microphone permission...');
    checkMicPermission().catch(error => {
      console.warn('⚠️ Mic permission check failed:', error);
    });
  }, []);

  const checkMicPermission = async () => {
    try {
      console.log('Checking microphone permission...');
      const audioConstraints = configService.getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('Microphone permission granted!');
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setHasPermission(false);
    }
  };

  const connectToDeepgram = async (): Promise<() => void> => {
    console.log('🔗 [DEEPGRAM] Starting Deepgram connection...');
    
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

    // Инициализируем RAG сервис (временно отключен)
    console.log('📝 RAG service temporarily disabled for debugging');

    // Инициализируем Claude сервис если доступен
    if (configService.isClaudeConfigured()) {
      try {
        const claudeConfig = configService.getClaudeConfig();
        claudeRef.current = createClaudeService(claudeConfig); // RAG disabled
        analysisContextRef.current = new AnalysisContext();
        console.log('✅ Claude service initialized with RAG support:', {
          model: claudeConfig.model,
          maxTokens: claudeConfig.maxTokens,
          temperature: claudeConfig.temperature,
          ragEnabled: false // temporarily disabled
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
          jobTerms: [], // Будет добавлено позже
          synonymDictionary: {} // Будет заполнено в post-editor.ts
        };
        console.log('🔧 Post-editor enabled:', {
          model: postEditorConfig.model,
          timeout: postEditorConfig.timeoutMs
        });
      } else {
        console.log('⚠️ Post-editor not configured, skipping...');
      }
      
      const deepgram = createDeepgramService(
        deepgramConfig.apiKey,
        async (event: TranscriptEvent) => {
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
            
            // Отправляем в окно данных
            if (window.require) {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.invoke('send-transcript', transcript, newPartial);
            }
          } else if (event.type === 'final') {
            // Обновляем отображаемый транскрипт
            const newTranscript = (transcript + ' ' + event.text).trim();
            setTranscript(newTranscript);
            setPartialTranscript('');
            
            // Накапливаем полный транскрипт
            setFullTranscript(prev => (prev + ' ' + event.text).trim());
            
            console.log('✅ [FINAL] Deepgram final result:', {
              text: event.text,
              confidence: event.confidence,
              length: event.text.length,
              wordCount: event.text.split(' ').length
            });
            
            // Отправляем в окно данных
            if (window.require) {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.invoke('send-transcript', newTranscript, '');
            }
            
            // Анализируем с помощью Claude если доступен
            if (event.text.length > 10) {
              await analyzeWithClaude(event.text);
            }
          }
        },
        (error: string) => {
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
      );

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
      throw error; // Пробрасываем ошибку дальше - НИКАКИХ МОКОВ!
    }
  };

  // Анализ транскрипта с помощью Claude AI
  const analyzeWithClaude = async (newText: string): Promise<void> => {
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
      const newInsights = [...insights.slice(-2), legacyInsight];
      setInsights(newInsights);

      // Отправляем в окно данных
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('send-insights', newInsights);
      }

      console.log('✅ Claude analysis complete:', {
        topic: analysis.topic,
        depth_score: analysis.depth_score,
        type: analysis.type,
        confidence: analysis.confidence
      });

    } catch (error) {
      console.error('❌ Claude analysis failed:', error);
      // НИКАКИХ МОКОВ - просто логируем ошибку
    }
  };

  // МОК ФУНКЦИИ УДАЛЕНЫ - НИКАКИХ ФЕЙКОВ!

  const startRecording = async () => {
    try {
      console.log('🎬 [STEP 1] Starting recording...');
      
      // СНАЧАЛА меняем состояние UI для мгновенной реакции
      setIsRecording(true);
      console.log('✅ [STEP 2] UI state updated to recording');
      
      // Создаем окно с данными при начале записи
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('create-data-window'); // Убираем await для ускорения
        console.log('📱 [STEP 3] Data window creation requested');
      }
      
      // Остальные операции выполняем в фоне
      const audioConstraints = configService.getAudioConstraints();
      console.log('🎤 [STEP 4] Getting microphone access with constraints:', audioConstraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('✅ [STEP 5] Got media stream:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length
      });
      streamRef.current = stream;
      
      // Initialize audio analyser for SiriWave
      console.log('🎵 [STEP 6] Initializing audio analyser...');
      initAudioAnalyser(stream);
      
      // Connect to Deepgram (REAL ONLY - NO MOCKS!)
      console.log('📡 [STEP 7] Connecting to Deepgram...');
      try {
        cleanupRef.current = await connectToDeepgram();
        console.log('✅ [STEP 8] Deepgram connection established');
      } catch (error) {
        console.error('❌ [DEEPGRAM] Connection failed:', error);
        setIsRecording(false);
        setHasPermission(false);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Deepgram connection failed: ${errorMessage}`);
      }
      
      // Используем AudioWorkletNode для получения PCM данных
      const audioConfig = configService.audio;
      console.log('🔧 [STEP 9] Creating AudioContext with config:', audioConfig);
      const audioContext = new AudioContext({ sampleRate: audioConfig.sampleRate });
      
      try {
        // Загружаем Audio Worklet
        console.log('⚙️ [STEP 10] Loading AudioWorklet module...');
        await audioContext.audioWorklet.addModule('/audioWorklet.js');
        console.log('✅ [STEP 11] AudioWorklet module loaded');
        
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        console.log('🔗 [STEP 12] AudioWorklet nodes created');
        
        // Счетчик для мониторинга потока данных
        let chunkCount = 0;
        let totalBytes = 0;
        
        // Слушаем PCM данные от worklet
        workletNode.port.onmessage = (event) => {
                  if (event.data.type === 'pcm-data' && deepgramRef.current) {
          chunkCount++;
          totalBytes += event.data.data.byteLength;
          
          // Логируем каждый 10-й чанк для мониторинга
          if (chunkCount % 10 === 0) {
            console.log(`📊 [AUDIO FLOW] Chunk #${chunkCount}: ${event.data.data.byteLength} bytes (total: ${(totalBytes/1024).toFixed(1)}KB)`);
          }
          
          deepgramRef.current.sendAudio(event.data.data);
        }
        };
        
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        // Сохраняем ссылки для очистки
        streamRef.current = stream;
        cleanupRef.current = () => {
          workletNode.disconnect();
          source.disconnect();
          audioContext.close();
          if (deepgramRef.current) {
            deepgramRef.current.disconnect();
            deepgramRef.current = null;
          }
          claudeRef.current = null;
          analysisContextRef.current = null;
        };
        
      } catch (error) {
        console.error('❌ AudioWorklet не поддерживается:', error);
        throw new Error(`AudioWorklet not supported: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.log('Recording started with Deepgram AudioWorklet!');
    } catch (error) {
      console.error('Error starting recording:', error);
      setHasPermission(false);
    }
  };

  // FALLBACK ФУНКЦИИ УДАЛЕНЫ - НИКАКИХ ОБХОДНЫХ ПУТЕЙ!

  const stopRecording = () => {
    // Закрываем окно с данными при остановке записи
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('close-data-window');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    // Завершаем сессию логирования транскрипции
    try {
      endCurrentSession();
      console.log('📊 Transcript session ended and saved to file');
    } catch (error) {
      console.warn('⚠️ Failed to end transcript session:', error);
    }
    
    // Очищаем ссылки на сервисы
            deepgramRef.current = null;
    claudeRef.current = null;
    if (analysisContextRef.current) {
      analysisContextRef.current.reset();
      analysisContextRef.current = null;
    }
    
    setIsRecording(false);
    setPartialTranscript('');
    // Оставляем transcript и insights для просмотра после остановки
    console.log('Recording stopped, session data preserved');
  };

  if (!isVisible) {
    return <div className="w-full h-full bg-transparent" />;
  }

  // Рендер разных типов окон
  if (windowType === 'data') {
    // Окно с данными - слушаем IPC события
    useEffect(() => {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        
        // Слушаем обновления транскрипта
        const handleTranscriptUpdate = (event: any, data: any) => {
          setTranscript(data.transcript || '');
          setPartialTranscript(data.partialTranscript || '');
        };

        // Слушаем обновления инсайтов
        const handleInsightsUpdate = (event: any, newInsights: any) => {
          setInsights(newInsights || []);
        };

        ipcRenderer.on('transcript-update', handleTranscriptUpdate);
        ipcRenderer.on('insights-update', handleInsightsUpdate);

        return () => {
          ipcRenderer.removeListener('transcript-update', handleTranscriptUpdate);
          ipcRenderer.removeListener('insights-update', handleInsightsUpdate);
        };
      }
    }, []);

    // Окно с данными (транскрипция + инсайты)
    return (
      <div className="w-full h-full bg-white/80 backdrop-blur-md p-4">
        <div className="content-panel">
          <div className="content-section">
            <div className="content-section__title">Transcript</div>
            <div className="content-section__content">
              {transcript || <span className="transcript-text--placeholder">Waiting for speech...</span>}
              {partialTranscript && (
                <span className="transcript-text--partial"> {partialTranscript}</span>
              )}
            </div>
          </div>
          
          <div className="content-section">
            <div className="content-section__title">AI Insights</div>
            <div className="content-section__content">
              {insights.length > 0 ? (
                insights.map((insight) => (
                  <div key={insight.id} className="insight-item">
                    {insight.text}
                  </div>
                ))
              ) : (
                <div className="insight-placeholder">Analyzing speech patterns...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Единая панель управления с анимацией между состояниями
  return (
    <div className={`w-full h-full ${isVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`} 
         style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}>
      
      <div className="w-full h-full flex items-center justify-center">
        <div className={`control-panel ${isRecording ? 'control-panel--recording' : ''} transition-all duration-500 ease-in-out`}>
          <div className="control-panel__actions">
            {/* Start/Stop Button с анимацией */}
            <div className="button-container">
              {!isRecording ? (
                <button
                  onClick={hasPermission ? startRecording : checkMicPermission}
                  className="start-button animate-fade-in"
                  style={{WebkitAppRegion: 'no-drag'} as any}
                >
                  <div className="start-button__icon">
                    <div className="start-button__icon-rect"></div>
                    <svg className="start-button__icon-svg" viewBox="0 0 8 10" fill="none">
                      <ellipse cx="4" cy="8" rx="4" ry="2" stroke="white" strokeWidth="1.4"/>
                    </svg>
                  </div>
                  <span>{hasPermission ? 'Start' : 'Allow Mic'}</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="stop-button animate-fade-in"
                  style={{WebkitAppRegion: 'no-drag'} as any}
                >
                  <div className="stop-button__icon"></div>
                </button>
              )}
            </div>
            
            {/* Wave Loader с анимацией появления/исчезновения */}
            <div className={`wave-loader-wrapper transition-all duration-500 ease-in-out ${
              isRecording 
                ? 'opacity-100 translate-x-0 w-auto' 
                : 'opacity-0 -translate-x-4 w-0 overflow-hidden'
            }`}>
              <WaveLoader
                isActive={isRecording}
                audioLevel={audioLevel}
                partialTranscript={partialTranscript}
                width={20}
                height={15}
              />
            </div>
          </div>
          
          <div className="control-panel__separator"></div>
          
          <div 
            className="control-panel__drag-zone"
            style={{WebkitAppRegion: 'drag'} as any}
          >
            <div className="drag-dots">
              <div className="drag-dots__dot"></div>
              <div className="drag-dots__dot"></div>
              <div className="drag-dots__dot"></div>
              <div className="drag-dots__dot"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Click-through индикатор */}
      {clickThrough && (
        <div className="click-through-indicator">
          Click-through mode
        </div>
      )}
    </div>
  );
}
