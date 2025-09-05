import { useEffect } from 'react';

/**
 * Хук для синхронизации данных между окнами через IPC
 * Обрабатывает отправку и получение данных между control и data окнами
 */
export const useWindowSync = (windowType: 'control' | 'data') => {
  
  // Функция для отправки данных в окно транскрипции (только для control окна)
  const sendToDataWindow = (type: 'transcript' | 'insights' | 'recording-state', data: any) => {
    try {
      if (window.require && windowType !== 'data') {
        const { ipcRenderer } = window.require('electron');
        console.log(`📤 [IPC] Sending ${type} to data window:`, data);
        
        if (type === 'transcript') {
          ipcRenderer.invoke('send-transcript', data);
        } else if (type === 'insights') {
          ipcRenderer.invoke('send-insights', data);
        } else if (type === 'recording-state') {
          ipcRenderer.invoke('send-recording-state', data.isRecording);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [IPC] Failed to send ${type}:`, error);
    }
  };

  // Функция для создания окна с данными
  const createDataWindow = () => {
    try {
      if (window.require && windowType !== 'data') {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('create-data-window');
        console.log('📱 [IPC] Data window creation requested');
      }
    } catch (error) {
      console.warn('⚠️ [IPC] Failed to create data window:', error);
    }
  };

  // Слушатели событий для data окна
  useEffect(() => {
    if (windowType === 'data' && window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Слушаем обновления транскрипта
      const handleTranscriptUpdate = (event: any, data: any) => {
        console.log('📝 [DATA WINDOW] Transcript update received:', data);
        // Здесь будет логика обновления состояний
      };

      // Слушаем обновления инсайтов
      const handleInsightsUpdate = (event: any, insights: any) => {
        console.log('🤖 [DATA WINDOW] Insights update received:', insights);
        // Здесь будет логика обновления состояний
      };

      // Слушаем изменения состояния записи
      const handleRecordingStateChange = (event: any, isRecordingState: boolean) => {
        console.log('🎤 [DATA WINDOW] Recording state change:', isRecordingState);
        // Здесь будет логика обновления состояний
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
  }, [windowType]);

  return {
    sendToDataWindow,
    createDataWindow,
  };
};
