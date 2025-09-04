// Unified interface for all transcription services
// Extracted from DeepgramService without changing logic

import { TranscriptEvent } from '../services/deepgram';

export interface ITranscriptionService {
  // Core connection methods
  connect(): Promise<void>;
  disconnect(): void;
  
  // Audio streaming
  sendAudio(audioData: ArrayBuffer): void;
  
  // Event callbacks (set in constructor)
  onTranscript(callback: (event: TranscriptEvent) => void): void;
  onError(callback: (error: string) => void): void;
}
