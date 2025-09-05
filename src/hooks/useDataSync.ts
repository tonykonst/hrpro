/**
 * useDataSync - Хук для синхронизации данных между окнами
 * 
 * Предоставляет:
 * - Автоматическую отправку данных в окно с данными
 * - Слушание обновлений в окне с данными
 * - Синхронизацию состояний между окнами
 */

import { useEffect, useCallback } from 'react';

export interface DataSyncOptions {
  windowType: 'control' | 'data';
  transcript?: string;
  partialTranscript?: string;
  insights?: any[];
  isRecording?: boolean;
  onTranscriptUpdate?: (data: { transcript?: string; partialTranscript?: string }) => void;
  onInsightsUpdate?: (insights: any[]) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

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
      if (window.require && windowType !== 'data') {
        const { ipcRenderer } = window.require('electron');
        console.log(`📤 [DataSync] Sending ${type} to data window:`, data);
        
        if (type === 'transcript') {
          ipcRenderer.invoke('send-transcript', data);
        } else if (type === 'insights') {
          ipcRenderer.invoke('send-insights', data);
        } else if (type === 'recording-state') {
          ipcRenderer.invoke('send-recording-state', data.isRecording);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [DataSync] Failed to send ${type}:`, error);
    }
  }, [windowType]);

  // Автоматическая отправка данных при изменении
  useEffect(() => {
    if (windowType === 'control' && transcript !== undefined) {
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

  // Слушатели событий для data окна
  useEffect(() => {
    if (windowType === 'data' && window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Слушаем обновления транскрипта
      const handleTranscriptUpdate = (event: any, data: any) => {
        console.log('📝 [DataSync] Transcript update received:', data);
        if (onTranscriptUpdate) {
          onTranscriptUpdate(data);
        }
      };

      // Слушаем обновления инсайтов
      const handleInsightsUpdate = (event: any, insights: any) => {
        console.log('🤖 [DataSync] Insights update received:', insights);
        if (onInsightsUpdate) {
          onInsightsUpdate(insights || []);
        }
      };

      // Слушаем изменения состояния записи
      const handleRecordingStateChange = (event: any, isRecordingState: boolean) => {
        console.log('🎤 [DataSync] Recording state change:', isRecordingState);
        if (onRecordingStateChange) {
          onRecordingStateChange(isRecordingState);
        }
      };

      ipcRenderer.on('transcript-update', handleTranscriptUpdate);
      ipcRenderer.on('insights-update', handleInsightsUpdate);
      ipcRenderer.on('recording-state-change', handleRecordingStateChange);

      return () => {
        ipcRenderer.removeAllListeners('transcript-update');
        ipcRenderer.removeAllListeners('insights-update');
        ipcRenderer.removeAllListeners('recording-state-change');
      };
    }
  }, [windowType, onTranscriptUpdate, onInsightsUpdate, onRecordingStateChange]);

  return {
    sendToDataWindow
  };
};
