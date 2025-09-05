import { useEffect } from 'react';

// Типы для electronAPI уже объявлены в App.tsx

/**
 * Хук для синхронизации данных между окнами через IPC
 * Обрабатывает отправку и получение данных между control и data окнами
 */
export const useWindowSync = (windowType: 'control' | 'data') => {
  
  // Функция для отправки данных в окно транскрипции (только для control окна)
  const sendToDataWindow = (type: 'transcript' | 'insights' | 'recording-state', data: any) => {
    try {
      if (window.electronAPI && windowType !== 'data') {
        console.log(`📤 [IPC] Sending ${type} to data window:`, data);
        
        if (type === 'transcript') {
          window.electronAPI.sendTranscript(data);
        } else if (type === 'insights') {
          window.electronAPI.sendInsights(data);
        } else if (type === 'recording-state') {
          window.electronAPI.sendRecordingState(data.isRecording);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [IPC] Failed to send ${type}:`, error);
    }
  };

  // Функция для создания окна с данными
  const createDataWindow = () => {
    try {
      if (window.electronAPI && windowType !== 'data') {
        window.electronAPI.createDataWindow();
        console.log('📱 [IPC] Data window creation requested');
      }
    } catch (error) {
      console.warn('⚠️ [IPC] Failed to create data window:', error);
    }
  };

  // Слушатели событий для data окна
  useEffect(() => {
    if (windowType === 'data' && window.electronAPI) {
      // Слушаем обновления транскрипта
      const handleTranscriptUpdate = (data: any) => {
        console.log('📝 [DATA WINDOW] Transcript update received:', data);
        // Здесь будет логика обновления состояний
      };

      // Слушаем обновления инсайтов
      const handleInsightsUpdate = (insights: any) => {
        console.log('🤖 [DATA WINDOW] Insights update received:', insights);
        // Здесь будет логика обновления состояний
      };

      // Слушаем изменения состояния записи
      const handleRecordingStateChange = (isRecordingState: boolean) => {
        console.log('🎤 [DATA WINDOW] Recording state change:', isRecordingState);
        // Здесь будет логика обновления состояний
      };

      // Регистрируем слушатели через electronAPI
      window.electronAPI.onTranscriptUpdate(handleTranscriptUpdate);
      window.electronAPI.onInsightsUpdate(handleInsightsUpdate);
      window.electronAPI.onRecordingStateChange(handleRecordingStateChange);

      return () => {
        window.electronAPI.removeAllListeners('transcript-update');
        window.electronAPI.removeAllListeners('insights-update');
        window.electronAPI.removeAllListeners('recording-state-change');
      };
    }
  }, [windowType]);

  return {
    sendToDataWindow,
    createDataWindow,
  };
};
