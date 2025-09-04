import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } from 'electron';
import { join } from 'path';

let controlPanelWindow: BrowserWindow | null = null;
let dataWindow: BrowserWindow | null = null;

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
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      enableRemoteModule: false,
      webSecurity: false
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
  if (dataWindow) return; // Не создавать дубликат

  // Настройки окна с данными
  const dataWindowOptions = {
    width: 600,
    height: 400,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      enableRemoteModule: false,
      webSecurity: false
    }
  };

  dataWindow = new BrowserWindow(dataWindowOptions);

  // Загружаем окно с данными
  dataWindow.loadURL('http://localhost:5173?window=data');

  // Позиционируем рядом с панелью управления
  if (controlPanelWindow) {
    const panelBounds = controlPanelWindow.getBounds();
    dataWindow.setPosition(panelBounds.x, panelBounds.y + panelBounds.height + 10);
  }

  // События окна данных
  dataWindow.on('closed', () => {
    dataWindow = null;
  });

  dataWindow.webContents.on('did-finish-load', () => {
    console.log('Data Window loaded successfully');
  });
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
    createDataWindow();
  });

  // Закрыть окно с данными
  ipcMain.handle('close-data-window', () => {
    if (dataWindow) {
      dataWindow.close();
      dataWindow = null;
    }
  });

  // Передать транскрипт в окно данных
  ipcMain.handle('send-transcript', (event, transcript, partialTranscript) => {
    if (dataWindow) {
      dataWindow.webContents.send('transcript-update', { transcript, partialTranscript });
    }
  });

  // Передать инсайты в окно данных
  ipcMain.handle('send-insights', (event, insights) => {
    if (dataWindow) {
      dataWindow.webContents.send('insights-update', insights);
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