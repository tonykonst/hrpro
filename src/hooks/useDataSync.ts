import { useEffect, useCallback } from 'react';

// Типы для electronAPI уже объявлены в App.tsx

export interface DataSyncOptions {
  windowType: 'control' | 'data';
  transcript?: string;
  partialTranscript?: string;
  insights?: any[];
  isRecording?: boolean;
  onTranscriptUpdate?: (data: any) => void;
  onInsightsUpdate?: (insights: any[]) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

/**
 * УПРОЩЕННЫЙ хук для синхронизации данных между окнами
 * - Автоматическую отправку данных в окно с данными
 * - Слушание обновлений в окне с данными
 * - Синхронизацию состояний между окнами
 */
export const useDataSync = (options: DataSyncOptions) => {
  const {
    windowType,
    transcript,
    partialTranscript,
    insights,
    isRecording,
    onTranscriptUpdate,
    onInsightsUpdate,
    onRecordingStateChange
  } = options;

  // Функция для отправки данных в окно с данными
  const sendToDataWindow = useCallback((type: 'transcript' | 'insights' | 'recording-state', data: any) => {
    try {
      console.log(`📤 [DataSync] sendToDataWindow called:`, { type, data, windowType, hasElectronAPI: !!window.electronAPI });
      
      if (window.electronAPI && windowType !== 'data') {
        console.log(`📤 [DataSync] Sending ${type} to data window:`, data);
        
        if (type === 'transcript') {
          console.log('📤 [DataSync] Calling window.electronAPI.sendTranscript');
          window.electronAPI.sendTranscript(data).then((result) => {
            console.log('📤 [DataSync] sendTranscript result:', result);
          }).catch((error) => {
            console.error('📤 [DataSync] sendTranscript error:', error);
          });
        } else if (type === 'insights') {
          window.electronAPI.sendInsights(data);
        } else if (type === 'recording-state') {
          window.electronAPI.sendRecordingState(data.isRecording);
        }
      } else {
        console.log(`📤 [DataSync] Not sending ${type}:`, { 
          hasElectronAPI: !!window.electronAPI, 
          windowType, 
          isDataWindow: windowType === 'data' 
        });
      }
    } catch (error) {
      console.warn(`⚠️ [DataSync] Failed to send ${type}:`, error);
    }
  }, [windowType]);

  // Автоматическая отправка данных при изменении
  useEffect(() => {
    if (windowType === 'control' && transcript !== undefined) {
      console.log('📤 [DataSync] Control window: transcript changed, sending to data window:', { transcript, partialTranscript });
      sendToDataWindow('transcript', { transcript, partialTranscript });
    }
  }, [transcript, partialTranscript, windowType, sendToDataWindow]);

  useEffect(() => {
    if (windowType === 'control' && insights !== undefined) {
      sendToDataWindow('insights', insights);
    }
  }, [insights, windowType, sendToDataWindow]);

  useEffect(() => {
    if (windowType === 'control' && isRecording !== undefined) {
      sendToDataWindow('recording-state', { isRecording });
    }
  }, [isRecording, windowType, sendToDataWindow]);

  // Слушатели событий для data окна - УПРОЩЕННАЯ ВЕРСИЯ
  useEffect(() => {
    console.log('📡 [DataSync] useEffect for data window listeners:', { windowType, hasElectronAPI: !!window.electronAPI, hasOnTranscriptUpdate: !!onTranscriptUpdate });
    
    if (windowType === 'data' && window.electronAPI) {
      console.log('📡 [DataSync] Setting up listeners for data window');
      
      let cleanupTranscript: (() => void) | undefined;
      let cleanupInsights: (() => void) | undefined;
      let cleanupRecording: (() => void) | undefined;

      // Слушаем обновления транскрипта
      if (onTranscriptUpdate) {
        console.log('📡 [DataSync] Registering onTranscriptUpdate listener');
        const cleanup = window.electronAPI.onTranscriptUpdate((data: any) => {
          console.log('📝 [DataSync] Transcript update received in data window:', data);
          onTranscriptUpdate(data);
        });
        cleanupTranscript = cleanup as (() => void) | undefined;
        console.log('📡 [DataSync] onTranscriptUpdate listener registered, cleanup function:', !!cleanupTranscript);
      } else {
        console.log('📡 [DataSync] No onTranscriptUpdate callback provided');
      }

      // Слушаем обновления инсайтов
      if (onInsightsUpdate) {
        const cleanup = window.electronAPI.onInsightsUpdate((insights: any) => {
          console.log('🤖 [DataSync] Insights update received:', insights);
          onInsightsUpdate(insights || []);
        });
        cleanupInsights = cleanup as (() => void) | undefined;
      }

      // Слушаем изменения состояния записи
      if (onRecordingStateChange) {
        const cleanup = window.electronAPI.onRecordingStateChange((isRecordingState: boolean) => {
          console.log('🎤 [DataSync] Recording state change:', isRecordingState);
          onRecordingStateChange(isRecordingState);
        });
        cleanupRecording = cleanup as (() => void) | undefined;
      }

      // Cleanup функция
      return () => {
        console.log('🧹 [DataSync] Cleaning up listeners');
        if (cleanupTranscript) cleanupTranscript();
        if (cleanupInsights) cleanupInsights();
        if (cleanupRecording) cleanupRecording();
      };
    }
  }, [windowType, onTranscriptUpdate, onInsightsUpdate, onRecordingStateChange]);

  return {
    sendToDataWindow
  };
};