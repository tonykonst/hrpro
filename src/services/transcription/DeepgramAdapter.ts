// DeepgramAdapter - адаптер для DeepgramService
// Реализует ITranscriptionService и делегирует все вызовы к DeepgramService

import { ITranscriptionService } from '../../types/ITranscriptionService';
import { DeepgramService, TranscriptEvent } from '../deepgram';

export class DeepgramAdapter implements ITranscriptionService {
  private deepgramService: DeepgramService;
  private onTranscriptCallback?: (event: TranscriptEvent) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(deepgramService: DeepgramService) {
    this.deepgramService = deepgramService;
  }

  // Делегируем ВСЕ методы к существующему DeepgramService
  async connect(): Promise<void> {
    return this.deepgramService.connect();
  }

  disconnect(): void {
    this.deepgramService.disconnect();
  }

  sendAudio(audioData: ArrayBuffer): void {
    this.deepgramService.sendAudio(audioData);
  }

  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.onTranscriptCallback = callback;
    console.log('📝 DeepgramAdapter: onTranscript callback set');
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
    console.log('❌ DeepgramAdapter: onError callback set');
  }

  // Методы для внутреннего использования
  getOnTranscriptCallback(): ((event: TranscriptEvent) => void) | undefined {
    return this.onTranscriptCallback;
  }

  getOnErrorCallback(): ((error: string) => void) | undefined {
    return this.onErrorCallback;
  }
}
