// Preload script для безопасного API между main и renderer процессами
// Решает проблему уязвимости API ключей и небезопасных Electron настроек

// Временно отключаем импорты для тестирования
// import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
// НЕ экспортируем API ключи - только безопасные методы
// Временно отключаем для тестирования
/*
contextBridge.exposeInMainWorld('electronAPI', {
  // Конфигурация (без API ключей)
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Транскрипция
  sendTranscript: (transcript: string, partialTranscript: string) => 
    ipcRenderer.invoke('send-transcript', { transcript, partialTranscript }),
  
  // Инсайты
  sendInsights: (insights: any[]) => 
    ipcRenderer.invoke('send-insights', insights),
  
  // Окна
  createDataWindow: () => ipcRenderer.invoke('create-data-window'),
  closeDataWindow: () => ipcRenderer.invoke('close-data-window'),
  
  // Слушатели событий
  onTranscriptUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('transcript-update', callback);
  },
  
  onInsightsUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('insights-update', callback);
  },
  
  // Удаление слушателей
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
*/

// Типы для TypeScript
// Временно отключаем для тестирования
/*
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      sendTranscript: (transcript: string, partialTranscript: string) => Promise<void>;
      sendInsights: (insights: any[]) => Promise<void>;
      createDataWindow: () => Promise<void>;
      closeDataWindow: () => Promise<void>;
      onTranscriptUpdate: (callback: (data: any) => void) => void;
      onInsightsUpdate: (callback: (data: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
*/

// console.log('🔒 Preload script loaded - secure API bridge established');
