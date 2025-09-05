import { useCallback } from 'react';
import { ITranscriptionService } from '../../types/ITranscriptionService';
import { ClaudeAnalysisService, AnalysisContext, createClaudeService } from '../../services/claude';
import { TranscriptionServiceFactory } from '../../services/transcription/TranscriptionServiceFactory';
import { configService } from '../../services/config';
import { PostEditorConfig, CorrectionContext } from '../../services/post-editor';
import { TranscriptEvent } from '../../services/deepgram';

/**
 * Core transcription functionality
 * 
 * @example
 * ```tsx
 * const core = useTranscriptionCore({
 *   deepgramRef,
 *   claudeRef,
 *   analysisContextRef,
 *   cleanupRef,
 *   handleTranscriptEvent
 * });
 * ```
 */
interface UseTranscriptionCoreProps {
  deepgramRef: React.MutableRefObject<ITranscriptionService | null>;
  claudeRef: React.MutableRefObject<ClaudeAnalysisService | null>;
  analysisContextRef: React.MutableRefObject<AnalysisContext | null>;
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  handleTranscriptEvent: (event: TranscriptEvent) => Promise<void>;
}

export const useTranscriptionCore = ({
  deepgramRef,
  claudeRef,
  analysisContextRef,
  cleanupRef,
  handleTranscriptEvent
}: UseTranscriptionCoreProps) => {

  /**
   * Connect to Deepgram service
   */
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
        onTranscript: handleTranscriptEvent,
        onError: (error: string) => {
          console.error('❌ [DEEPGRAM] Error:', error);
        }
      });
      
      // Сохраняем ссылку на сервис
      deepgramRef.current = deepgram;
      
      // Подключаемся к Deepgram
      await deepgram.connect();
      
      console.log('✅ [DEEPGRAM] Connected successfully!');
      
      // Возвращаем функцию очистки
      const cleanup = () => {
        console.log('🧹 [DEEPGRAM] Cleaning up connection...');
        if (deepgramRef.current) {
          deepgramRef.current.disconnect();
          deepgramRef.current = null;
        }
        if (claudeRef.current) {
          claudeRef.current = null;
        }
        if (analysisContextRef.current) {
          analysisContextRef.current = null;
        }
      };
      
      cleanupRef.current = cleanup;
      return cleanup;
      
    } catch (error) {
      console.error('❌ [DEEPGRAM] Connection failed:', error);
      throw error;
    }
  }, [deepgramRef, claudeRef, analysisContextRef, cleanupRef, handleTranscriptEvent]);

  return {
    connectToDeepgram
  };
};
