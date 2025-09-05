import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Базовые методы (пока без IPC handlers)
  getConfig: () => Promise.resolve({ 
    audio: { sampleRate: 16000 }, 
    ui: { theme: 'dark' },
    // Передаем переменные окружения через preload
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      POST_EDITOR_API_KEY: process.env.POST_EDITOR_API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  }),
  sendTranscript: (data: any) => {
    console.log('📤 [Preload] Sending transcript via IPC:', data);
    return ipcRenderer.invoke('send-transcript', data);
  },
  sendInsights: (data: any) => {
    console.log('📤 [Preload] Sending insights via IPC:', data);
    return ipcRenderer.invoke('send-insights', data);
  },
  sendRecordingState: (data: any) => {
    console.log('📤 [Preload] Sending recording state via IPC:', data);
    return ipcRenderer.invoke('send-recording-state', data);
  },
  createDataWindow: () => ipcRenderer.invoke('create-data-window'),
  closeDataWindow: () => ipcRenderer.invoke('close-data-window'),
  
  // Слушатели событий - УПРОЩЕННАЯ ВЕРСИЯ
  onTranscriptUpdate: (callback: (data: any) => void) => {
    console.log('📡 [Preload] onTranscriptUpdate registered');
    const handler = (event: any, data: any) => {
      console.log('📝 [Preload] Received transcript-update:', data);
      callback(data);
    };
    ipcRenderer.on('transcript-update', handler);
    
    // Возвращаем функцию для очистки
    return () => {
      ipcRenderer.removeListener('transcript-update', handler);
    };
  },
  onInsightsUpdate: (callback: (data: any) => void) => {
    console.log('📡 [Preload] onInsightsUpdate registered');
    const handler = (event: any, data: any) => {
      console.log('🤖 [Preload] Received insights-update:', data);
      callback(data);
    };
    ipcRenderer.on('insights-update', handler);
    
    return () => {
      ipcRenderer.removeListener('insights-update', handler);
    };
  },
  onRecordingStateChange: (callback: (data: any) => void) => {
    console.log('📡 [Preload] onRecordingStateChange registered');
    const handler = (event: any, data: any) => {
      console.log('🎤 [Preload] Received recording-state-change:', data);
      callback(data);
    };
    ipcRenderer.on('recording-state-change', handler);
    
    return () => {
      ipcRenderer.removeListener('recording-state-change', handler);
    };
  },
  onWindowCreated: (callback: (windowId: string) => void) => {
    console.log('📡 [Preload] onWindowCreated registered');
    const handler = (event: any, windowId: string) => {
      console.log('📱 [Preload] Received window-created:', windowId);
      callback(windowId);
    };
    ipcRenderer.on('window-created', handler);
    
    return () => {
      ipcRenderer.removeListener('window-created', handler);
    };
  },
  onWindowClosed: (callback: (windowId: string) => void) => {
    console.log('📡 [Preload] onWindowClosed registered');
    const handler = (event: any, windowId: string) => {
      console.log('📱 [Preload] Received window-closed:', windowId);
      callback(windowId);
    };
    ipcRenderer.on('window-closed', handler);
    
    return () => {
      ipcRenderer.removeListener('window-closed', handler);
    };
  },
  
  // Удаление слушателей
  removeAllListeners: (channel: string) => {
    console.log(`📡 [Preload] removeAllListeners called for ${channel}`);
    ipcRenderer.removeAllListeners(channel);
  }
  
  // НЕ экспортируем API ключи!
});