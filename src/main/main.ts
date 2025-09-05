import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } from 'electron';
import { join } from 'path';
import * as path from 'path';

let controlPanelWindow: BrowserWindow | null = null;
let dataWindow: BrowserWindow | null = null;

// Очередь для данных, отправляемых до создания окна
let pendingTranscriptData: any[] = [];
let pendingInsightsData: any[] = [];
let pendingRecordingStateData: any[] = [];

function createControlPanelWindow() {
  // Адаптивные настройки окна - размер по содержимому
  const windowOptions = {
    width: 200,          // Начальная ширина
    height: 56,          // Начальная высота (точно по панели)
    minWidth: 100,       // Минимальная ширина
    minHeight: 56,       // Минимальная высота
    maxWidth: 800,       // Максимальная ширина
    maxHeight: 120,      // Максимальная высота
    useContentSize: true, // Размер по содержимому
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,     // Разрешить изменение размера
    webPreferences: {
      nodeIntegration: false,       // ✅ БЕЗОПАСНО
      contextIsolation: true,       // ✅ БЕЗОПАСНО
      backgroundThrottling: false,
      enableRemoteModule: false,
      webSecurity: true,            // ✅ БЕЗОПАСНО
      preload: path.join(__dirname, '..', 'preload', 'preload.js') // ✅ PRELOAD
    }
  };

  controlPanelWindow = new BrowserWindow(windowOptions);

  // Загружаем панель управления
  controlPanelWindow.loadURL('http://localhost:5173?window=control');
  
  // Открываем DevTools в отдельном окне
  controlPanelWindow.webContents.openDevTools({ mode: 'detach' });
  
  controlPanelWindow.webContents.on('did-fail-load', () => {
    console.log('Failed to load Control Panel, retrying...');
    setTimeout(() => {
      controlPanelWindow?.loadURL('http://localhost:5173?window=control');
    }, 1000);
  });

  // События панели управления
  controlPanelWindow.on('closed', () => {
    controlPanelWindow = null;
    // Закрываем окно данных если открыто
    if (dataWindow) {
      dataWindow.close();
    }
  });

  controlPanelWindow.webContents.on('did-finish-load', () => {
    console.log('Control Panel loaded successfully');
  });
}

function createDataWindow() {
  console.log('🚀 [MAIN] Creating data window...');
  
  if (dataWindow && !dataWindow.isDestroyed()) {
    console.log('✅ [MAIN] Data window already exists, showing it');
    dataWindow.show();
    dataWindow.focus();
    return;
  }

  // Настройки окна с данными - ТОЧНО КАК У ПАНЕЛИ УПРАВЛЕНИЯ
  const dataWindowOptions = {
    width: 600,
    height: 400,
    minWidth: 400,
    minHeight: 300,
    useContentSize: true,           // ✅ РАЗМЕР ПО СОДЕРЖИМОМУ
    frame: false,                   // ✅ БЕЗ СИСТЕМНОЙ РАМКИ
    transparent: true,              // ✅ ПОЛУПРОЗРАЧНОЕ
    backgroundColor: '#00000000',   // ✅ ПРОЗРАЧНЫЙ ФОН
    hasShadow: false,               // ✅ БЕЗ ТЕНИ (как у панели)
    alwaysOnTop: true,
    skipTaskbar: true,              // ✅ НЕ В ПАНЕЛИ ЗАДАЧ (как у панели)
    resizable: true,
    show: false,                    // ✅ НЕ ПОКАЗЫВАТЬ СРАЗУ
    webPreferences: {
      nodeIntegration: false,       // ✅ БЕЗОПАСНО
      contextIsolation: true,       // ✅ БЕЗОПАСНО
      backgroundThrottling: false,
      enableRemoteModule: false,
      webSecurity: true,            // ✅ БЕЗОПАСНО
      preload: path.join(__dirname, '..', 'preload', 'preload.js') // ✅ PRELOAD
    }
  };

  console.log('🔧 [MAIN] Creating BrowserWindow with options:', dataWindowOptions);
  dataWindow = new BrowserWindow(dataWindowOptions);

  // Загружаем окно с данными
  console.log('📡 [MAIN] Loading URL: http://localhost:5173?window=data');
  dataWindow.loadURL('http://localhost:5173?window=data');

  // Позиционируем рядом с панелью управления
  if (controlPanelWindow) {
    const panelBounds = controlPanelWindow.getBounds();
    console.log('📍 [MAIN] Positioning data window next to control panel:', panelBounds);
    // Размещаем окно данных под панелью управления
    dataWindow.setPosition(panelBounds.x, panelBounds.y + panelBounds.height + 10);
  } else {
    console.log('📍 [MAIN] No control panel found, using default position');
    dataWindow.setPosition(100, 100);
  }

  // События окна данных
  dataWindow.on('closed', () => {
    console.log('❌ [MAIN] Data window closed');
    dataWindow = null;
  });

  // Добавляем логирование всех событий окна для отладки
  dataWindow.on('close', (event) => {
    console.log('🚪 [MAIN] Data window close event triggered');
    console.log('🚪 [MAIN] Close event preventDefault available:', typeof event.preventDefault === 'function');
    
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Предотвращаем закрытие окна
    console.log('🛡️ [MAIN] Preventing data window close with preventDefault');
    event.preventDefault();
    
    // Вместо закрытия - скрываем окно
    if (dataWindow && !dataWindow.isDestroyed()) {
      console.log('👁️ [MAIN] Hiding data window instead of closing');
      dataWindow.hide();
    }
  });

  dataWindow.on('closed', () => {
    console.log('🚪 [MAIN] Data window closed event (duplicate handler)');
  });

  dataWindow.on('unresponsive', () => {
    console.log('⚠️ [MAIN] Data window became unresponsive');
  });

  dataWindow.on('responsive', () => {
    console.log('✅ [MAIN] Data window became responsive');
  });

  dataWindow.on('ready-to-show', () => {
    console.log('✅ [MAIN] Data window ready to show');
    if (dataWindow) {
      dataWindow.show();
      dataWindow.focus();
      console.log('👁️ [MAIN] Data window should be visible now');
    }
  });

  dataWindow.webContents.on('did-finish-load', () => {
    console.log('📄 [MAIN] Data window content loaded successfully');
    if (dataWindow) {
      console.log('👁️ [MAIN] Showing data window after content load');
      dataWindow.show();
      dataWindow.focus();
      
      // Включаем DevTools для отладки renderer process
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [MAIN] Opening DevTools for data window');
        dataWindow.webContents.openDevTools();
      }
    }
  });

  dataWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ [MAIN] Data window failed to load:', errorCode, errorDescription);
  });

  console.log('🎯 [MAIN] Data window creation completed');
  
  // Обрабатываем очередь данных после создания окна
  processPendingData();
}

// Функция для обработки очереди данных
function processPendingData() {
  if (!dataWindow || dataWindow.isDestroyed()) {
    return;
  }
  
  console.log('📦 [MAIN] Processing pending data:', {
    transcript: pendingTranscriptData.length,
    insights: pendingInsightsData.length,
    recordingState: pendingRecordingStateData.length
  });
  
  // Отправляем накопленные данные транскрипции
  pendingTranscriptData.forEach(data => {
    console.log('📦 [MAIN] Sending pending transcript:', data);
    dataWindow!.webContents.send('transcript-update', data);
  });
  pendingTranscriptData = [];
  
  // Отправляем накопленные данные инсайтов
  pendingInsightsData.forEach(data => {
    console.log('📦 [MAIN] Sending pending insights:', data);
    dataWindow!.webContents.send('insights-update', data);
  });
  pendingInsightsData = [];
  
  // Отправляем накопленные данные состояния записи
  pendingRecordingStateData.forEach(data => {
    console.log('📦 [MAIN] Sending pending recording state:', data);
    dataWindow!.webContents.send('recording-state-change', data);
  });
  pendingRecordingStateData = [];
}

// Регистрируем глобальные горячие клавиши
function registerGlobalShortcuts() {
  // Ctrl/Cmd + \ для показа/скрытия панели управления
  globalShortcut.register('CommandOrControl+\\', () => {
    if (controlPanelWindow) {
      if (controlPanelWindow.isVisible()) {
        controlPanelWindow.hide();
        if (dataWindow) dataWindow.hide();
      } else {
        controlPanelWindow.show();
        controlPanelWindow.focus();
        if (dataWindow) dataWindow.show();
      }
    }
  });

  console.log('Global shortcuts registered');
}

// IPC handlers для управления окнами
function setupIPC() {
  // Получить позицию и размер панели управления
  ipcMain.handle('get-window-bounds', () => {
    if (!controlPanelWindow) return null;
    return controlPanelWindow.getBounds();
  });

  // Создать окно с данными
  ipcMain.handle('create-data-window', () => {
    console.log('📡 [IPC] Received create-data-window request');
    try {
      createDataWindow();
      console.log('✅ [IPC] Data window creation initiated');
      // Уведомляем renderer о создании окна
      if (controlPanelWindow) {
        controlPanelWindow.webContents.send('window-created', 'data');
        console.log('📤 [IPC] Sent window-created event to control panel');
      }
      return { success: true, message: 'Data window creation initiated' };
    } catch (error) {
      console.error('❌ [IPC] Failed to create data window:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Скрыть окно с данными (НЕ закрывать!)
  ipcMain.handle('close-data-window', () => {
    console.log('👁️ [IPC] Hiding data window instead of closing');
    if (dataWindow && !dataWindow.isDestroyed()) {
      dataWindow.hide(); // ← СКРЫВАЕМ вместо закрытия!
      console.log('✅ [IPC] Data window hidden successfully');
      // НЕ устанавливаем dataWindow = null - окно остается живым!
      
      // Уведомляем renderer о скрытии окна
      if (controlPanelWindow) {
        controlPanelWindow.webContents.send('window-closed', 'data');
        console.log('📤 [IPC] Sent window-closed event to control panel');
      }
    }
  });

  // Передать транскрипт в окно данных
  ipcMain.handle('send-transcript', (event, data) => {
    console.log('📝 [IPC] Sending transcript to data window:', data);
    console.log('📝 [IPC] Data window exists:', !!dataWindow);
    console.log('📝 [IPC] Data window isDestroyed:', dataWindow?.isDestroyed());
    
    try {
      if (dataWindow && !dataWindow.isDestroyed()) {
        console.log('📝 [IPC] Sending transcript-update event to data window');
        dataWindow.webContents.send('transcript-update', data);
        console.log('✅ [IPC] Transcript sent successfully');
      } else {
        console.log('📦 [IPC] Data window not available, adding to pending queue');
        pendingTranscriptData.push(data);
        console.log('📦 [IPC] Pending transcript queue size:', pendingTranscriptData.length);
      }
    } catch (error) {
      console.error('❌ [IPC] Failed to send transcript:', error);
    }
  });

  // Передать инсайты в окно данных
  ipcMain.handle('send-insights', (event, insights) => {
    console.log('🤖 [IPC] Sending insights to data window:', insights);
    
    try {
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('insights-update', insights);
        console.log('✅ [IPC] Insights sent successfully');
      } else {
        console.log('📦 [IPC] Data window not available, adding to pending queue');
        pendingInsightsData.push(insights);
        console.log('📦 [IPC] Pending insights queue size:', pendingInsightsData.length);
      }
    } catch (error) {
      console.error('❌ [IPC] Failed to send insights:', error);
    }
  });

  // Отправить изменение состояния записи
  ipcMain.handle('send-recording-state', (event, isRecording) => {
    console.log('🎤 [IPC] Sending recording state change:', isRecording);
    
    try {
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('recording-state-change', isRecording);
        console.log('✅ [IPC] Recording state sent successfully');
      } else {
        console.log('📦 [IPC] Data window not available, adding to pending queue');
        pendingRecordingStateData.push(isRecording);
        console.log('📦 [IPC] Pending recording state queue size:', pendingRecordingStateData.length);
      }
    } catch (error) {
      console.error('❌ [IPC] Failed to send recording state:', error);
    }
  });

  // Получить информацию о дисплее
  ipcMain.handle('get-display-info', () => {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    return { displays, primaryDisplay };
  });

  // Захватить экран
  ipcMain.handle('capture-screen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      
      if (sources.length > 0) {
        return sources[0].thumbnail.toDataURL();
      }
      return null;
    } catch (error) {
      console.error('Screen capture failed:', error);
      return null;
    }
  });
}

// События приложения
app.whenReady().then(() => {
  createControlPanelWindow();
  registerGlobalShortcuts();
  setupIPC();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlPanelWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Убираем все глобальные горячие клавиши
  globalShortcut.unregisterAll();
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});