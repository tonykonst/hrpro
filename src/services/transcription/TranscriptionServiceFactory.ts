// TranscriptionServiceFactory - фабрика для создания транскрипционных сервисов
// Создает адаптеры для разных провайдеров ASR

import { ITranscriptionService } from '../../types/ITranscriptionService';
import { DeepgramAdapter } from './DeepgramAdapter';
import { createDeepgramService, DeepgramConfig } from '../deepgram';
import { PostEditorConfig, CorrectionContext } from '../post-editor';
import { TranscriptEvent } from '../deepgram';

export interface TranscriptionConfig {
  provider: 'deepgram' | 'whisper' | 'other';
  apiKey: string;
  onTranscript: (event: TranscriptEvent) => void;
  onError: (error: string) => void;
  deepgramConfig?: DeepgramConfig;
  postEditorConfig?: PostEditorConfig;
  correctionContext?: CorrectionContext;
}

export class TranscriptionServiceFactory {
  static create(config: TranscriptionConfig): ITranscriptionService {
    switch (config.provider) {
      case 'deepgram':
        // Создаем DeepgramService и оборачиваем в адаптер
        const deepgramService = createDeepgramService(
          config.apiKey,
          config.onTranscript,
          config.onError,
          config.deepgramConfig,
          config.postEditorConfig,
          config.correctionContext
        );
        
        return new DeepgramAdapter(deepgramService);
        
      case 'whisper':
        // TODO: Добавить поддержку Whisper в будущем
        throw new Error('Whisper provider not implemented yet');
        
      case 'other':
        // TODO: Добавить поддержку других провайдеров в будущем
        throw new Error('Other providers not implemented yet');
        
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
