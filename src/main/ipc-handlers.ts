// IPC handlers для безопасной коммуникации между main и renderer процессами
// Решает проблему уязвимости API ключей

import { ipcMain } from 'electron';
// Временно отключаем configService для тестирования
// import { configService } from '../services/config';

// Безопасная конфигурация (без API ключей)
ipcMain.handle('get-config', () => {
  try {
    // Возвращаем только безопасную конфигурацию
    return {
      audio: {
        sampleRate: 16000,
        channels: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        chunkSize: 250
      },
      ui: {
        insightFrequencyMs: 3000,
        minInsightConfidence: 0.6,
        transcriptBufferWords: 600,
        maxInsightsDisplay: 3,
        defaultActivePanel: 'transcript',
        defaultClickThrough: false
      },
      // НЕ возвращаем API ключи!
      // НЕ возвращаем конфигурацию API!
      environment: process.env.NODE_ENV || 'development'
    };
  } catch (error) {
    console.error('❌ Error getting config:', error);
    throw new Error('Failed to get configuration');
  }
});

// Обработчик транскрипции
ipcMain.handle('send-transcript', async (event, data) => {
  try {
    const { transcript, partialTranscript } = data;
    console.log('📝 [IPC] Transcript update:', {
      transcript: transcript?.substring(0, 50) + '...',
      partialTranscript: partialTranscript?.substring(0, 30) + '...'
    });
    
    // Здесь можно добавить логику для окна данных
    // Пока просто логируем
    return { success: true };
  } catch (error) {
    console.error('❌ [IPC] Error sending transcript:', error);
    throw new Error('Failed to send transcript');
  }
});

// Обработчик инсайтов
ipcMain.handle('send-insights', async (event, insights) => {
  try {
    console.log('🤖 [IPC] Insights update:', {
      count: insights?.length || 0,
      types: insights?.map((i: any) => i.type) || []
    });
    
    // Здесь можно добавить логику для окна данных
    // Пока просто логируем
    return { success: true };
  } catch (error) {
    console.error('❌ [IPC] Error sending insights:', error);
    throw new Error('Failed to send insights');
  }
});

// Обработчик создания окна данных
ipcMain.handle('create-data-window', async () => {
  try {
    console.log('📱 [IPC] Creating data window...');
    // Логика создания окна будет в main.ts
    return { success: true };
  } catch (error) {
    console.error('❌ [IPC] Error creating data window:', error);
    throw new Error('Failed to create data window');
  }
});

// Обработчик закрытия окна данных
ipcMain.handle('close-data-window', async () => {
  try {
    console.log('📱 [IPC] Closing data window...');
    // Логика закрытия окна будет в main.ts
    return { success: true };
  } catch (error) {
    console.error('❌ [IPC] Error closing data window:', error);
    throw new Error('Failed to close data window');
  }
});

console.log('🔒 IPC handlers registered - secure communication established');
