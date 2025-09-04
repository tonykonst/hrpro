export { WhisperTranscriptionServiceV041 } from './WhisperTranscriptionServiceV041';
export { RealWhisperService } from './transcription/RealWhisperService';
export { SmartBufferManager } from './buffering/SmartBufferManager';
export { EnhancedVAD } from './buffering/EnhancedVAD';

/**
 * Фабрика для создания Whisper сервиса v0.41
 * Заменяет createDeepgramService
 */
export const createWhisperServiceV041 = (
  onTranscript: (text: string, isPartial: boolean, confidence: number) => void,
  onError: (error: string) => void
) => {
  const service = new WhisperTranscriptionServiceV041();
  
  console.log('🏭 Creating Whisper v0.41 service...');
  
  return {
    service,
    connect: () => service.connect(onTranscript, onError),
    disconnect: () => service.disconnect(),
    getStats: () => service.getStats()
  };
};
